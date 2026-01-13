// /app/api/stripe/check-subscription/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check for active subscription
    const { data: subscription, error } = await supabaseAdmin
      .from("subscriptions")
      .select("*, token_packages(*)")
      .eq("user_id", userId)
      .in("status", ["active", "trialing"])
      .maybeSingle();

    if (error && error.code !== "PGRST116") { // PGRST116 = no rows returned
      console.error("Error checking subscription:", error);
      return NextResponse.json(
        { error: "Failed to check subscription" },
        { status: 500 }
      );
    }

    if (!subscription) {
      return NextResponse.json({
        hasActiveSubscription: false,
      });
    }

    return NextResponse.json({
      hasActiveSubscription: true,
      subscription: {
        id: subscription.id,
        packageName: subscription.token_packages.name,
        tokens: subscription.token_packages.tokens,
        price: subscription.token_packages.priceUSD,
        status: subscription.status,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    });
  } catch (error) {
    console.error("Check subscription error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}