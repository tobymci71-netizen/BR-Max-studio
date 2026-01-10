import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { hasPurchase: false, authenticated: false },
        { status: 401 },
      );
    }

    // Check if user is an admin
    const { data: settingsData, error: settingsError } = await supabaseAdmin
      .from("system_settings")
      .select("admin_user_ids")
      .single();


    if (!settingsError && settingsData) {
      const adminUserIds = settingsData.admin_user_ids || [];

      if (adminUserIds.includes(userId)) {
        return NextResponse.json({ hasPurchase: true, isAdmin: true });
      }
    }

    // Check for token purchase
    const { data, error } = await supabaseAdmin
      .from("token_transactions")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "token_purchase")
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    const hasPurchase = Boolean(data);

    return NextResponse.json({ hasPurchase });
  } catch (error) {
    console.error("[STUDIO-ACCESS] ❌ Studio access check failed:", error);
    return NextResponse.json(
      { hasPurchase: false, error: "Failed to evaluate studio access" },
      { status: 500 },
    );
  }
}
