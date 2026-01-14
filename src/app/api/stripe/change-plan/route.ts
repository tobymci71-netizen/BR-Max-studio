// /app/api/stripe/change-plan/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { newPriceId } = await req.json();
    if (!newPriceId) {
      return NextResponse.json(
        { error: "newPriceId is required" },
        { status: 400 }
      );
    }

    // 1️⃣ Get active subscription from DB
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_subscription_id")
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    if (!sub) {
      return NextResponse.json(
        { error: "Active subscription not found" },
        { status: 404 }
      );
    }

    const subscriptionId = sub.stripe_subscription_id;

    // 2️⃣ Get subscription + current price
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const item = subscription.items.data[0];

    const currentPrice = await stripe.prices.retrieve(item.price.id);
    const newPrice = await stripe.prices.retrieve(newPriceId);

    if (!currentPrice.unit_amount || !newPrice.unit_amount) {
      return NextResponse.json(
        { error: "Invalid price configuration" },
        { status: 400 }
      );
    }

    // 3️⃣ Determine upgrade or downgrade
    const isUpgrade = newPrice.unit_amount > currentPrice.unit_amount;

    // 4️⃣ Update subscription
    await stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          id: item.id,
          price: newPriceId,
        },
      ],
      proration_behavior: isUpgrade ? "create_prorations" : "none",
      billing_cycle_anchor: isUpgrade ? undefined : "unchanged",
    });

    return NextResponse.json({
      success: true,
      type: isUpgrade ? "upgrade" : "downgrade",
    });
  } catch (err) {
    console.error("Change plan error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
