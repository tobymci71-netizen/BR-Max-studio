import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { ReferralPayment } from "@/types/referral";

export const runtime = "nodejs";

/**
 * POST - Record a referred subscription (called from Stripe webhook)
 */
export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const data = payload as Record<string, unknown>;
  const referral_code = typeof data.referral_code === "string" ? data.referral_code.trim() : "";
  const referred_user_id = typeof data.referred_user_id === "string" ? data.referred_user_id.trim() : "";
  const subscription_id = typeof data.subscription_id === "string" ? data.subscription_id.trim() : "";
  const subscription_amount =
    typeof data.subscription_amount === "number"
      ? data.subscription_amount
      : typeof data.subscription_amount === "string"
        ? Number(data.subscription_amount)
        : 0;

  if (!referral_code || !referred_user_id || !subscription_id) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    // Find the referral by code
    const { data: referral, error: fetchError } = await supabaseAdmin
      .from("referrals")
      .select("*")
      .eq("referral_code", referral_code)
      .single();

    if (fetchError || !referral) {
      console.error("[record-subscription] Referral not found:", referral_code);
      return NextResponse.json({ error: "Referral not found" }, { status: 404 });
    }

    // Check if referral is active
    if (referral.status !== "active") {
      console.error("[record-subscription] Referral is inactive:", referral_code);
      return NextResponse.json({ error: "Referral is inactive" }, { status: 400 });
    }

    // Check if user already referred
    const existingReferredUserIds = referral.referred_user_ids || [];
    if (existingReferredUserIds.includes(referred_user_id)) {
      return NextResponse.json({ ok: true, message: "User already tracked" });
    }

    // Create the payment record
    const newPayment: ReferralPayment = {
      userId: referred_user_id,
      subscriptionId: subscription_id,
      subscriptionAmount: subscription_amount,
      paymentPercentage: referral.commission_percentage,
      amountToPay: (subscription_amount * referral.commission_percentage) / 100,
      isPaid: false,
      paidAt: null,
    };

    // Update referral with new referred user
    const updatedReferredUserIds = [referred_user_id, ...existingReferredUserIds];
    const updatedPayments = [newPayment, ...(referral.referral_payments || [])];

    const { error: updateError } = await supabaseAdmin
      .from("referrals")
      .update({
        referred_user_ids: updatedReferredUserIds,
        total_referrals_count: updatedReferredUserIds.length,
        referral_payments: updatedPayments,
        updated_at: new Date().toISOString(),
      })
      .eq("referral_id", referral.referral_id);

    if (updateError) {
      console.error("[record-subscription] Update error:", updateError);
      return NextResponse.json({ error: "Failed to update referral" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: "Referral recorded successfully" });
  } catch (error) {
    console.error("[record-subscription] Unexpected error:", error);
    return NextResponse.json({ error: "Unable to record referral" }, { status: 500 });
  }
}
