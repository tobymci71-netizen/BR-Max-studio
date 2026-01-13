// /app/api/stripe/subscription/reactivate/route.ts
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
        { status: 500 }
      );
    }

    if (!subscription) {
      return NextResponse.json(
        { error: "No subscription found" },
        { status: 404 }
      );
    }

    // Reactivate subscription in Stripe
    try {
      const stripeSubscription = await stripe.subscriptions.update(
        subscription.stripe_subscription_id,
        {
          cancel_at_period_end: false,
        }
      );

      console.log("✅ Subscription reactivated in Stripe:", stripeSubscription.id);

      // Update database
      const { error: updateError } = await supabaseAdmin
        .from("subscriptions")
        .update({
          cancel_at_period_end: false,
        })
        .eq("id", subscription.id);

      if (updateError) {
        console.error("Error updating subscription in database:", updateError);
        // Don't fail the request since Stripe is updated
      }

      return NextResponse.json({
        success: true,
        message: "Subscription has been reactivated",
      });
    } catch (stripeError) {
      console.error("Error reactivating subscription in Stripe:", stripeError);
      return NextResponse.json(
        { error: "Failed to reactivate subscription" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in subscription reactivate:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
