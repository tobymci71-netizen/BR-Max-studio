import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * GET - Get current user's referral information
 */
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find referral by user_id
    const { data: referral, error: fetchError } = await supabaseAdmin
      .from("referrals")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchError) {
      console.error("[my-referral] Database error:", fetchError);
      return NextResponse.json({ error: "Failed to fetch referral data" }, { status: 500 });
    }

    // If no referral found, return hasReferral: false
    if (!referral) {
      return NextResponse.json({ 
        hasReferral: false,
        message: "You don't have a referral code yet. Please contact support to get one."
      });
    }

    // Return referral data
    return NextResponse.json({
      hasReferral: true,
      referral: {
        referral_id: referral.referral_id,
        referral_code: referral.referral_code,
        referral_link: referral.referral_link,
        commission_percentage: referral.commission_percentage,
        total_referrals_count: referral.total_referrals_count,
        referred_user_ids: referral.referred_user_ids || [],
        paid_user_ids: referral.paid_user_ids || [],
        referral_payments: referral.referral_payments || [],
        status: referral.status,
        created_at: referral.created_at,
        updated_at: referral.updated_at,
      },
    });
  } catch (error) {
    console.error("[my-referral] Unexpected error:", error);
    return NextResponse.json({ error: "Unable to fetch referral data" }, { status: 500 });
  }
}
