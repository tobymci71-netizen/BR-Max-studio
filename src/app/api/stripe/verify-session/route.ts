// /app/api/stripe/verify-session/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Missing STRIPE_SECRET_KEY");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "Session ID is required" },
        { status: 400 }
      );
    }

    console.log("🔍 Verifying session:", sessionId);

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Session not found" },
        { status: 404 }
      );
    }

    console.log("📋 Session details:", {
      id: session.id,
      payment_status: session.payment_status,
      subscription: session.subscription
    });

    // Check if payment was successful
    if (session.payment_status !== "paid") {
      console.log("❌ Payment not completed");
      return NextResponse.json(
        { success: false, error: "Payment not completed", status: "payment_incomplete" },
        { status: 400 }
      );
    }

    // Get subscription details
    const subscriptionId = session.subscription as string;
    
    if (!subscriptionId) {
      console.log("❌ No subscription found in session");
      return NextResponse.json(
        { success: false, error: "No subscription found", status: "no_subscription" },
        { status: 404 }
      );
    }

    // Wait for webhook to process - REASONABLE retry: 3 attempts over 3 seconds
    console.log("⏳ Checking if subscription exists in database...");
    
    let subscription = null;
    let attempts = 0;
    const maxAttempts = 3; // Only 3 attempts
    const delayMs = 1000; // 1 second between attempts

    while (attempts < maxAttempts) {
      const { data, error } = await supabaseAdmin
        .from("subscriptions")
        .select("*, token_packages(*)")
        .eq("stripe_subscription_id", subscriptionId)
        .maybeSingle();

      if (!error && data) {
        subscription = data;
        console.log("✅ Subscription found in database!");
        break;
      }

      attempts++;
      if (attempts < maxAttempts) {
        console.log(`⏳ Attempt ${attempts}/${maxAttempts}, waiting ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    if (!subscription) {
      console.log("❌ Subscription not found in database after webhook processing");
      console.log("⚠️ Webhook may have failed - check webhook logs");
      
      // Return processing state with basic info from Stripe
      const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
      
      return NextResponse.json({
        success: false,
        status: "webhook_failed",
        error: "Subscription creation failed",
        message: "Your payment was successful, but there was an error setting up your subscription. Please contact support.",
        subscription: {
          packageName: session.metadata?.package_name || "Subscription",
          tokens: Number(session.metadata?.tokens || 0),
          price: session.amount_total ? (session.amount_total / 100).toFixed(2) : "0",
          status: stripeSubscription.status,
          stripeSubscriptionId: subscriptionId,
        },
      });
    }

    // VERIFY: Check that tokens were actually credited
    const { data: tokenLog } = await supabaseAdmin
      .from("subscription_payment_logs")
      .select("*")
      .eq("stripe_subscription_id", subscriptionId)
      .eq("status", "completed")
      .maybeSingle();

    if (!tokenLog) {
      console.log("⚠️ Subscription exists but tokens not credited");
      return NextResponse.json({
        success: false,
        status: "tokens_not_credited",
        error: "Tokens were not credited",
        message: "Subscription was created but tokens were not added. Please contact support.",
      });
    }

    console.log("✅ Subscription fully verified and active!");

    const tokenPackage = subscription.token_packages;

    return NextResponse.json({
      success: true,
      status: "active",
      subscription: {
        id: subscription.id,
        packageName: tokenPackage.name,
        tokens: parseInt(tokenPackage.tokens),
        price: tokenPackage.priceUSD,
        status: subscription.status,
        nextBillingDate: subscription.current_period_end,
        tokensCredited: tokenLog.tokens_credited,
        transactionId: tokenLog.transaction_id,
      },
    });
  } catch (error) {
    console.error("❌ Error verifying session:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to verify session",
        status: "error",
        message: "An error occurred while verifying your subscription. Please contact support."
      },
      { status: 500 }
    );
  }
}