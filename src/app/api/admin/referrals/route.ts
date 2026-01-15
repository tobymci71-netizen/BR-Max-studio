import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateAdminAuth } from "@/lib/adminAuth";
import type { Referral, CreateReferralPayload } from "@/types/referral";

export const runtime = "nodejs";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://studio.brmax.xyz";

/**
 * GET - List all referrals
 */
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("referrals")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[admin referrals] List error:", error);
      return NextResponse.json({ error: "Failed to fetch referrals" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, referrals: data ?? [] });
  } catch (error) {
    console.error("[admin referrals] Unexpected error:", error);
    return NextResponse.json({ error: "Unable to fetch referrals" }, { status: 500 });
  }
}

/**
 * POST - Create a new referral
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

  const data = payload as Record<string, unknown> & CreateReferralPayload;
  const user_id = typeof data.user_id === "string" ? data.user_id.trim() : "";
  const referral_code = typeof data.referral_code === "string" ? data.referral_code.trim() : "";
  const commission_percentage =
    typeof data.commission_percentage === "number"
      ? data.commission_percentage
      : typeof data.commission_percentage === "string"
        ? Number(data.commission_percentage)
        : NaN;

  if (!user_id) {
    return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
  }

  if (!referral_code) {
    return NextResponse.json({ error: "Missing referral_code" }, { status: 400 });
  }

  if (!Number.isFinite(commission_percentage) || commission_percentage < 0 || commission_percentage > 100) {
    return NextResponse.json({ error: "Commission percentage must be between 0 and 100" }, { status: 400 });
  }

  // Check if referral code already exists
  const { data: existingCode } = await supabaseAdmin
    .from("referrals")
    .select("referral_id")
    .eq("referral_code", referral_code)
    .single();

  if (existingCode) {
    return NextResponse.json({ error: "Referral code already exists" }, { status: 400 });
  }

  // Check if user already has a referral
  const { data: existingUser } = await supabaseAdmin
    .from("referrals")
    .select("referral_id")
    .eq("user_id", user_id)
    .single();

  if (existingUser) {
    return NextResponse.json({ error: "User already has a referral" }, { status: 400 });
  }

  const referral_link = `${BASE_URL}/subscribe?r=${encodeURIComponent(referral_code)}`;
  const now = new Date().toISOString();

  const newReferral: Omit<Referral, "referral_id"> = {
    user_id,
    referral_code,
    referral_link,
    commission_percentage,
    total_referrals_count: 0,
    referred_user_ids: [],
    paid_user_ids: [],
    referral_payments: [],
    status: "active",
    created_at: now,
    updated_at: now,
  };

  try {
    const { data: created, error } = await supabaseAdmin
      .from("referrals")
      .insert(newReferral)
      .select()
      .single();

    if (error) {
      console.error("[admin referrals] Create error:", error);
      return NextResponse.json({ error: "Failed to create referral" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, referral: created });
  } catch (error) {
    console.error("[admin referrals] Unexpected error:", error);
    return NextResponse.json({ error: "Unable to create referral" }, { status: 500 });
  }
}

/**
 * PUT - Update an existing referral
 */
export async function PUT(req: NextRequest) {
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
  const referral_code = typeof data.referral_code === "string" ? data.referral_code.trim() : "";
  const commission_percentage =
    typeof data.commission_percentage === "number"
      ? data.commission_percentage
      : typeof data.commission_percentage === "string"
        ? Number(data.commission_percentage)
        : NaN;

  if (!referral_id) {
    return NextResponse.json({ error: "Missing referral_id" }, { status: 400 });
  }

  if (!referral_code) {
    return NextResponse.json({ error: "Missing referral_code" }, { status: 400 });
  }

  if (!Number.isFinite(commission_percentage) || commission_percentage < 0 || commission_percentage > 100) {
    return NextResponse.json({ error: "Commission percentage must be between 0 and 100" }, { status: 400 });
  }

  // Check if referral code already exists (for a different referral)
  const { data: existingCode } = await supabaseAdmin
    .from("referrals")
    .select("referral_id")
    .eq("referral_code", referral_code)
    .neq("referral_id", referral_id)
    .single();

  if (existingCode) {
    return NextResponse.json({ error: "Referral code already exists" }, { status: 400 });
  }

  const referral_link = `${BASE_URL}/subscribe?r=${encodeURIComponent(referral_code)}`;

  try {
    const { data: updated, error } = await supabaseAdmin
      .from("referrals")
      .update({
        referral_code,
        referral_link,
        commission_percentage,
        updated_at: new Date().toISOString(),
      })
      .eq("referral_id", referral_id)
      .select()
      .single();

    if (error) {
      console.error("[admin referrals] Update error:", error);
      return NextResponse.json({ error: "Failed to update referral" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, referral: updated });
  } catch (error) {
    console.error("[admin referrals] Unexpected error:", error);
    return NextResponse.json({ error: "Unable to update referral" }, { status: 500 });
  }
}

/**
 * PATCH - Update referral status (activate/deactivate)
 */
export async function PATCH(req: NextRequest) {
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
  const status = data.status === "active" ? "active" : data.status === "inactive" ? "inactive" : null;

  if (!referral_id) {
    return NextResponse.json({ error: "Missing referral_id" }, { status: 400 });
  }

  if (!status) {
    return NextResponse.json({ error: "Invalid status. Must be 'active' or 'inactive'" }, { status: 400 });
  }

  try {
    const { data: updated, error } = await supabaseAdmin
      .from("referrals")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("referral_id", referral_id)
      .select()
      .single();

    if (error) {
      console.error("[admin referrals] Status update error:", error);
      return NextResponse.json({ error: "Failed to update referral status" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, referral: updated });
  } catch (error) {
    console.error("[admin referrals] Unexpected error:", error);
    return NextResponse.json({ error: "Unable to update referral status" }, { status: 500 });
  }
}

interface ReferralPayment {
  amountToPay: number;
  isPaid: boolean;
}

/**
 * DELETE - Delete a referral (only if all payments are paid)
 */
export async function DELETE(req: NextRequest) {
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

  if (!referral_id) {
    return NextResponse.json({ error: "Missing referral_id" }, { status: 400 });
  }

  try {
    // Fetch the referral to check for unpaid amounts
    const { data: referral, error: fetchError } = await supabaseAdmin
      .from("referrals")
      .select("*")
      .eq("referral_id", referral_id)
      .single();

    if (fetchError || !referral) {
      return NextResponse.json({ error: "Referral not found" }, { status: 404 });
    }

    // Calculate unpaid amount
    const payments = (referral.referral_payments || []) as ReferralPayment[];
    const unpaidAmount = payments
      .filter((p) => !p.isPaid)
      .reduce((sum, p) => sum + (p.amountToPay || 0), 0);

    if (unpaidAmount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete referral with unpaid amount ($${unpaidAmount.toFixed(2)}). Please mark all payments as paid first or deactivate the referral instead.`
        },
        { status: 400 }
      );
    }

    // Delete the referral
    const { error: deleteError } = await supabaseAdmin
      .from("referrals")
      .delete()
      .eq("referral_id", referral_id);

    if (deleteError) {
      console.error("[admin referrals] Delete error:", deleteError);
      return NextResponse.json({ error: "Failed to delete referral" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: "Referral deleted successfully" });
  } catch (error) {
    console.error("[admin referrals] Unexpected error:", error);
    return NextResponse.json({ error: "Unable to delete referral" }, { status: 500 });
  }
}
