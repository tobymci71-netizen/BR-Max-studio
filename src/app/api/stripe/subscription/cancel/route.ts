// /app/api/stripe/subscription/cancel/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Missing STRIPE_SECRET_KEY");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-12-15.clover',
});

export async function POST() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Fetch active subscription from database
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
        { status: 500 }
      );
    }

    if (!subscription) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 404 }
      );
    }

    // Cancel subscription in Stripe (at period end)
    try {
      const stripeSubscription = await stripe.subscriptions.update(
        subscription.stripe_subscription_id,
        {
          cancel_at_period_end: true,
        }
      );

      console.log("✅ Subscription cancelled in Stripe:", stripeSubscription.id);

      // Update database to reflect cancellation
      const { error: updateError } = await supabaseAdmin
        .from("subscriptions")
        .update({
          cancel_at_period_end: true,
        })
        .eq("id", subscription.id);

      if (updateError) {
        console.error("Error updating subscription in database:", updateError);
        // Don't fail the request since Stripe is updated
      }

      return NextResponse.json({
        success: true,
        message: "Subscription will be cancelled at the end of the billing period",
        // @ts-expect-error IT does exist
        cancelAt: stripeSubscription.current_period_end,
      });
    } catch (stripeError) {
      console.error("Error cancelling subscription in Stripe:", stripeError);
      return NextResponse.json(
        { error: "Failed to cancel subscription" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in subscription cancel:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
