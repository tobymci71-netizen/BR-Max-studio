import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * GET - Verify a referral code and return basic info
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Missing referral code" }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("referrals")
      .select("referral_id, referral_code, user_id")
      .eq("referral_code", code)
      .single();

    if (error || !data) {
      return NextResponse.json({ valid: false, error: "Invalid referral code" }, { status: 404 });
    }

    // Get the referrer's name for display
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("full_name")
      .eq("user_id", data.user_id)
      .single();

    return NextResponse.json({
      valid: true,
      referral_code: data.referral_code,
      referrer_name: user?.full_name || "A friend",
    });
  } catch (error) {
    console.error("[referral verify] Error:", error);
    return NextResponse.json({ error: "Unable to verify referral code" }, { status: 500 });
  }
}
