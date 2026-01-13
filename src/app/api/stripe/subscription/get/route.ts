// /app/api/stripe/subscription/get/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Missing STRIPE_SECRET_KEY");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-12-15.clover",
});

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch subscription from database
    const { data: subscription, error: subError } = await supabaseAdmin
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (subError) {
      console.error("Error fetching subscription:", subError);
      return NextResponse.json(
        { error: "Failed to fetch subscription" },
        { status: 500 },
      );
    }

    // No active subscription
    if (!subscription) {
      return NextResponse.json({
        hasSubscription: false,
        subscription: null,
      });
    }

    // Fetch latest details from Stripe
    let stripeSubscription = null;
    const { data: tokenPackage, error: tokenPackgeError } = await supabaseAdmin
      .from("token_packages")
      .select("*")
      .eq("id", subscription.package_id)
      .maybeSingle();

    if (tokenPackgeError) {
      console.error("Error fetching package of the subscription:", tokenPackgeError);
      return NextResponse.json(
        { error: "Failed to fetch package of the subscription" },
        { status: 500 },
      );
    }

    try {
      stripeSubscription = await stripe.subscriptions.retrieve(
        subscription.stripe_subscription_id,
      );
    } catch (stripeError) {
      console.error("Error fetching from Stripe:", stripeError);
      // Continue with database data even if Stripe fails
    }

    // Get payment method if available
    let paymentMethod = null;
    if (stripeSubscription?.default_payment_method) {
      try {
        const pm = await stripe.paymentMethods.retrieve(
          stripeSubscription.default_payment_method as string,
        );
        paymentMethod = {
          brand: pm.card?.brand || "card",
          last4: pm.card?.last4 || "****",
          expMonth: pm.card?.exp_month,
          expYear: pm.card?.exp_year,
        };
      } catch (pmError) {
        console.error("Error fetching payment method:", pmError);
      }
    }

    // Combine data
    const subscriptionData = {
      hasSubscription: true,
      subscription: {
        id: subscription.id,
        packageId: subscription.package_id,
        packageName: tokenPackage?.name || "Package might not be available for details",
        tokens: tokenPackage?.tokens || 0,
        price: tokenPackage?.priceUSD || 0,
        status: stripeSubscription?.status || subscription.status,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd:
          stripeSubscription?.cancel_at_period_end ||
          subscription.cancel_at_period_end,
        canceledAt: subscription.canceled_at,
        stripeSubscriptionId: subscription.stripe_subscription_id,
        stripeCustomerId: subscription.stripe_customer_id,
        createdAt: subscription.created_at,
        updatedAt: subscription.updated_at,
        paymentMethod,
      },
    };

    return NextResponse.json(subscriptionData);
  } catch (error) {
    console.error("Error in subscription GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
