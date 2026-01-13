// /app/api/stripe/webhook/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { addTokenTransaction } from "@/lib/tokenTransactions";
import { sendSubscriptionEmail } from "@/lib/emailUtil";

// Type extensions for Stripe objects
interface StripeInvoiceWithSubscription extends Stripe.Invoice {
  subscription: string | Stripe.Subscription | null;
}

interface TokenPackage {
  tokens: string;
  name: string;
}

// Extended subscription type to handle period dates in both locations
interface SubscriptionWithPeriodDates {
  current_period_start?: number;
  current_period_end?: number;
}

interface SubscriptionItemWithPeriod {
  current_period_start?: number;
  current_period_end?: number;
  [key: string]: unknown;
}

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Missing STRIPE_SECRET_KEY");
}

if (!process.env.STRIPE_WEBHOOK_SECRET) {
  throw new Error("Missing STRIPE_WEBHOOK_SECRET");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-12-15.clover', // Use latest API version
});

// This is critical for webhooks - we need the raw body
export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    console.error("❌ No Stripe signature found");
    return NextResponse.json(
      { error: "No signature" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  console.log("🔵 Stripe webhook received:", event.type);

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event.data.object as StripeInvoiceWithSubscription);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as StripeInvoiceWithSubscription);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("❌ Webhook handler error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

// Handle initial subscription creation
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log("🎉 Checkout completed:", session.id);

  const userId = session.metadata?.user_id || session.client_reference_id;
  const packageId = session.metadata?.package_id;
  const tokens = Number(session.metadata?.tokens || 0);
  const packageName = session.metadata?.package_name || "Subscription";

  if (!userId || !packageId) {
    console.error("❌ Missing metadata in checkout session");
    return;
  }

  // Get the subscription ID
  const subscriptionId = session.subscription as string;

  if (!subscriptionId) {
    console.error("❌ No subscription ID in checkout session");
    return;
  }

  // Check if subscription already exists in database (idempotency)
  const { data: existing } = await supabaseAdmin
    .from("subscriptions")
    .select("id")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();

  if (existing) {
    console.log("⚠️ Subscription already exists in database");
    return;
  }

  // Fetch subscription details from Stripe - DON'T use expand, get it directly
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Extract period dates - handle both old and new Stripe billing modes
  // In new flexible billing mode, dates are in subscription items
  const subWithDates = subscription as unknown as SubscriptionWithPeriodDates;
  let currentPeriodStart = subWithDates.current_period_start;
  let currentPeriodEnd = subWithDates.current_period_end;

  // If not at top level, get from first subscription item (new billing mode)
  if (typeof currentPeriodStart !== 'number' || typeof currentPeriodEnd !== 'number') {
    const firstItem = subscription.items?.data?.[0] as unknown as SubscriptionItemWithPeriod | undefined;
    if (firstItem) {
      currentPeriodStart = firstItem.current_period_start;
      currentPeriodEnd = firstItem.current_period_end;
    }
  }

  console.log("📋 Subscription retrieved:", {
    id: subscription.id,
    status: subscription.status,
    current_period_start: currentPeriodStart,
    current_period_end: currentPeriodEnd,
    created: subscription.created
  });

  // CRITICAL: These are unix timestamps, they should ALWAYS exist
  if (typeof currentPeriodStart !== 'number' || typeof currentPeriodEnd !== 'number') {
    console.error("❌ Invalid subscription period dates from Stripe");
    console.error("Full subscription object:", JSON.stringify(subscription, null, 2));
    throw new Error("Invalid subscription period dates");
  }

  // Create subscription record with proper date conversion
  const { error: subError } = await supabaseAdmin
    .from("subscriptions")
    .insert({
      user_id: userId,
      package_id: packageId,
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: subscription.customer as string,
      status: subscription.status,
      current_period_start: new Date(currentPeriodStart * 1000).toISOString(),
      current_period_end: new Date(currentPeriodEnd * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
    });

  if (subError) {
    console.error("❌ Failed to create subscription record:", subError);
    throw subError;
  }

  console.log("✅ Subscription record created in database");

  // Credit tokens for the first month
  await creditTokensForSubscription(
    userId,
    tokens,
    subscriptionId,
    "initial",
    packageName
  );

  // Send welcome email
  try {
    const nextBillingDate = new Date(currentPeriodEnd * 1000).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    await sendSubscriptionEmail({
      to: session.customer_email || session.customer_details?.email || "",
      type: "subscription_started",
      tokens,
      subscriptionId,
      packageName,
      nextBillingDate,
    });
    console.log("✅ Welcome email sent");
  } catch (emailError) {
    console.error("⚠️ Failed to send email (non-critical):", emailError);
  }
}

// Handle recurring payments
async function handleInvoicePaymentSucceeded(invoice: StripeInvoiceWithSubscription) {
  console.log("💳 Invoice payment succeeded:", invoice.id);

  const subscriptionId = typeof invoice.subscription === 'string'
    ? invoice.subscription
    : invoice.subscription?.id;

  if (!subscriptionId) {
    console.log("ℹ️ Invoice not related to subscription, skipping");
    return;
  }

  // Check if this is the first invoice (handled by checkout.session.completed)
  if (invoice.billing_reason === "subscription_create") {
    console.log("ℹ️ First invoice, already handled by checkout.session.completed");
    return;
  }

  // Fetch subscription from database
  const { data: subscription, error: subError } = await supabaseAdmin
    .from("subscriptions")
    .select("*, token_packages(*)")
    .eq("stripe_subscription_id", subscriptionId)
    .single();

  if (subError || !subscription) {
    console.error("❌ Subscription not found in database:", subscriptionId);
    console.error("This is likely because checkout.session.completed webhook failed");
    return;
  }

  // Check idempotency - see if we already credited tokens for this invoice
  const { data: existingLog } = await supabaseAdmin
    .from("subscription_payment_logs")
    .select("id")
    .eq("stripe_invoice_id", invoice.id)
    .maybeSingle();

  if (existingLog) {
    console.log("⚠️ Tokens already credited for this invoice");
    return;
  }

  // Credit tokens for recurring payment
  const tokenPackage = subscription.token_packages as unknown as TokenPackage;
  const tokens = parseInt(tokenPackage.tokens);
  const packageName = tokenPackage.name;
  
  await creditTokensForSubscription(
    subscription.user_id,
    tokens,
    subscriptionId,
    "recurring",
    packageName,
    invoice.id
  );

  // Send renewal email
  try {
    // Get next billing date from Stripe subscription
    const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);

    // Extract period end - handle both old and new billing modes
    const subWithDates = stripeSubscription as unknown as SubscriptionWithPeriodDates;
    let periodEnd = subWithDates.current_period_end;
    if (typeof periodEnd !== 'number') {
      const firstItem = stripeSubscription.items?.data?.[0] as unknown as SubscriptionItemWithPeriod | undefined;
      if (firstItem) {
        periodEnd = firstItem.current_period_end;
      }
    }

    if (typeof periodEnd === 'number') {
      const nextBillingDate = new Date(periodEnd * 1000).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });

      await sendSubscriptionEmail({
        to: invoice.customer_email || "",
        type: "subscription_renewed",
        tokens,
        subscriptionId,
        packageName,
        nextBillingDate,
      });
      console.log("✅ Renewal email sent");
    } else {
      console.warn("⚠️ Could not determine next billing date for renewal email");
    }
  } catch (emailError) {
    console.error("⚠️ Failed to send email (non-critical):", emailError);
  }
}

// Handle subscription status updates
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log("🔄 Subscription updated:", subscription.id);

  // Extract period dates - handle both old and new Stripe billing modes
  const subWithDates = subscription as unknown as SubscriptionWithPeriodDates;
  let currentPeriodStart = subWithDates.current_period_start;
  let currentPeriodEnd = subWithDates.current_period_end;

  // If not at top level, get from first subscription item (new billing mode)
  if (typeof currentPeriodStart !== 'number' || typeof currentPeriodEnd !== 'number') {
    const firstItem = subscription.items?.data?.[0] as unknown as SubscriptionItemWithPeriod | undefined;
    if (firstItem) {
      currentPeriodStart = firstItem.current_period_start;
      currentPeriodEnd = firstItem.current_period_end;
    }
  }

  // Validate dates
  if (typeof currentPeriodStart !== 'number' || typeof currentPeriodEnd !== 'number') {
    console.error("❌ Invalid subscription period dates in update");
    return;
  }

  const { error } = await supabaseAdmin
    .from("subscriptions")
    .update({
      status: subscription.status,
      current_period_start: new Date(currentPeriodStart * 1000).toISOString(),
      current_period_end: new Date(currentPeriodEnd * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : null,
    })
    .eq("stripe_subscription_id", subscription.id);

  if (error) {
    console.error("❌ Failed to update subscription:", error);
    throw error;
  }

  console.log("✅ Subscription updated in database");
}

// Handle subscription cancellation
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log("❌ Subscription deleted:", subscription.id);

  const { error } = await supabaseAdmin
    .from("subscriptions")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id);

  if (error) {
    console.error("❌ Failed to update subscription status:", error);
    throw error;
  }

  // Get subscription details for email
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("user_id, token_packages(*)")
    .eq("stripe_subscription_id", subscription.id)
    .single();

  if (sub) {
    try {
      const stripeCustomer = await stripe.customers.retrieve(subscription.customer as string);
      const email = (stripeCustomer as Stripe.Customer).email;

      if (email) {
        const tokenPackage = sub.token_packages as unknown as TokenPackage;
        await sendSubscriptionEmail({
          to: email,
          type: "subscription_canceled",
          tokens: parseInt(tokenPackage.tokens),
          subscriptionId: subscription.id,
          packageName: tokenPackage.name,
        });
        console.log("✅ Cancellation email sent");
      }
    } catch (emailError) {
      console.error("⚠️ Failed to send cancellation email:", emailError);
    }
  }

  console.log("✅ Subscription canceled in database");
}

// Handle payment failures
async function handlePaymentFailed(invoice: StripeInvoiceWithSubscription) {
  console.log("⚠️ Payment failed:", invoice.id);

  const subscriptionId = typeof invoice.subscription === 'string'
    ? invoice.subscription
    : invoice.subscription?.id;

  if (!subscriptionId) {
    return;
  }

  // Get subscription details
  const { data: subscription } = await supabaseAdmin
    .from("subscriptions")
    .select("user_id, token_packages(*)")
    .eq("stripe_subscription_id", subscriptionId)
    .single();

  if (subscription) {
    // Log the failed payment
    await supabaseAdmin.from("subscription_payment_logs").insert({
      user_id: subscription.user_id,
      stripe_subscription_id: subscriptionId,
      stripe_invoice_id: invoice.id,
      status: "failed",
      amount: (invoice.amount_due / 100).toString(),
      currency: invoice.currency,
      error_message: "Payment failed",
    });

    // Send payment failed email
    try {
      const stripeCustomer = await stripe.customers.retrieve(invoice.customer as string);
      const email = (stripeCustomer as Stripe.Customer).email;

      if (email) {
        const failureReason = invoice.last_finalization_error?.message ||
                             "Unable to process payment";

        const tokenPackage = subscription.token_packages as unknown as TokenPackage;
        await sendSubscriptionEmail({
          to: email,
          type: "payment_failed",
          subscriptionId,
          packageName: tokenPackage.name,
          failureReason,
        });
        console.log("✅ Payment failure email sent");
      }
    } catch (emailError) {
      console.error("⚠️ Failed to send payment failed email:", emailError);
    }
  }
}

// Helper function to credit tokens
async function creditTokensForSubscription(
  userId: string,
  tokens: number,
  subscriptionId: string,
  type: "initial" | "recurring",
  packageName: string,
  invoiceId?: string
) {
  console.log(`💰 Crediting ${tokens} tokens to user ${userId}`);

  // Generate transaction ID
  const shortUid = userId.slice(-6).toUpperCase();
  const timeStr = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  const transactionId = `SUB-${shortUid}-${timeStr}${random}`;

  // Add token transaction
  const transactionResult = await addTokenTransaction({
    userId,
    type: "subscription",
    amount: tokens,
    description: `${packageName} subscription - ${type === "initial" ? "Initial" : "Monthly"} tokens`,
    metadata: {
      transaction_id: transactionId,
      stripe_subscription_id: subscriptionId,
      ...(invoiceId && { stripe_invoice_id: invoiceId }),
      subscription_type: type,
      package_name: packageName,
    },
  });

  if (!transactionResult.success) {
    console.error("❌ Failed to credit tokens:", transactionId);
    throw new Error(`Failed to credit tokens for subscription ${subscriptionId}`);
  }

  // Log the subscription payment
  await supabaseAdmin.from("subscription_payment_logs").insert({
    user_id: userId,
    transaction_id: transactionId,
    stripe_subscription_id: subscriptionId,
    ...(invoiceId && { stripe_invoice_id: invoiceId }),
    status: "completed",
    tokens_credited: tokens,
  });

  console.log("✅ Tokens credited successfully:", transactionId);
}