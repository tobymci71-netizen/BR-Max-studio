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

    let referral = null;

    const { data, error } = await supabaseAdmin
      .from("referrals")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("[my-referral] Database error:", error);
      return NextResponse.json(
        { error: "Failed to fetch referral data" },
        { status: 500 },
      );
    }

    referral = data;

    if (!referral && process.env.FAKE_REFERRAL_RECORD_ID_FOR_TESTING) {
      const { data: referralFake, error: fakeError } = await supabaseAdmin
        .from("referrals")
        .select("*")
        .eq("referral_id", process.env.FAKE_REFERRAL_RECORD_ID_FOR_TESTING)
        .maybeSingle();

      if (fakeError) {
        console.error("[my-referral] Fake referral fetch error:", fakeError);
      } else {
        referral = referralFake;
      }
    }

    if (!referral) {
      return NextResponse.json({
        hasReferral: false,
        message:
          "You don't have a referral code yet. Please contact support to get one.",
      });
    }

    // Fetch user details for all referred users
    const referredUserIds = referral.referred_user_ids || [];
    let userDetails: Record<string, { full_name?: string; email?: string }> = {};

    if (referredUserIds.length > 0) {
      const { data: users, error: usersError } = await supabaseAdmin
        .from("users")
        .select("user_id, full_name, email")
        .in("user_id", referredUserIds);

      if (!usersError && users) {
        userDetails = users.reduce((acc, user) => {
          acc[user.user_id] = {
            full_name: user.full_name,
            email: user.email,
          };
          return acc;
        }, {} as Record<string, { full_name?: string; email?: string }>);
      }
    }

    // Return referral data with user details
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
      userDetails,
    });
  } catch (error) {
    console.error("[my-referral] Unexpected error:", error);
    return NextResponse.json(
      { error: "Unable to fetch referral data" },
      { status: 500 },
    );
  }
}
