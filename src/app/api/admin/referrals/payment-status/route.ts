import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateAdminAuth } from "@/lib/adminAuth";

export const runtime = "nodejs";

interface ReferralPayment {
  userId: string;
  subscriptionId: string;
  subscriptionAmount: number;
  paymentPercentage: number;
  amountToPay: number;
  isPaid: boolean;
  paidAt: string | null;
}

/**
 * POST - Update payment status for a referred user
 */
export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const auth = validateAdminAuth(payload);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const data = payload as Record<string, unknown>;
  const referral_id = typeof data.referral_id === "string" ? data.referral_id.trim() : "";
  const payment_user_id = typeof data.payment_user_id === "string" ? data.payment_user_id.trim() : "";
  const is_paid = data.is_paid === true;

  if (!referral_id) {
    return NextResponse.json({ error: "Missing referral_id" }, { status: 400 });
  }

  if (!payment_user_id) {
    return NextResponse.json({ error: "Missing payment_user_id" }, { status: 400 });
  }

  try {
    // Fetch the referral
    const { data: referral, error: fetchError } = await supabaseAdmin
      .from("referrals")
      .select("*")
      .eq("referral_id", referral_id)
      .single();

    if (fetchError || !referral) {
      console.error("[payment-status] Referral not found:", referral_id);
      return NextResponse.json({ error: "Referral not found" }, { status: 404 });
    }

    // Get and update the payments array
    const payments = (referral.referral_payments || []) as ReferralPayment[];
    const paymentIndex = payments.findIndex((p) => p.userId === payment_user_id);

    if (paymentIndex === -1) {
      return NextResponse.json({ error: "Payment record not found" }, { status: 404 });
    }

    // Update the payment status
    payments[paymentIndex] = {
      ...payments[paymentIndex],
      isPaid: is_paid,
      paidAt: is_paid ? new Date().toISOString() : null,
    };

    // Update paid_user_ids array
    let paidUserIds = (referral.paid_user_ids || []) as string[];
    if (is_paid && !paidUserIds.includes(payment_user_id)) {
      paidUserIds = [...paidUserIds, payment_user_id];
    } else if (!is_paid) {
      paidUserIds = paidUserIds.filter((id) => id !== payment_user_id);
    }

    // Save the updated referral
    const { error: updateError } = await supabaseAdmin
      .from("referrals")
      .update({
        referral_payments: payments,
        paid_user_ids: paidUserIds,
        updated_at: new Date().toISOString(),
      })
      .eq("referral_id", referral_id);

    if (updateError) {
      console.error("[payment-status] Update error:", updateError);
      return NextResponse.json({ error: "Failed to update payment status" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: `Payment marked as ${is_paid ? "paid" : "unpaid"}` });
  } catch (error) {
    console.error("[payment-status] Unexpected error:", error);
    return NextResponse.json({ error: "Unable to update payment status" }, { status: 500 });
  }
}
