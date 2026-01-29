import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("system_settings")
      .select("maintenance_mode, maintenance_message, admin_user_ids, created_at")
      .single();

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { error: "Failed to fetch system settings" },
        { status: 500 }
      );
    }
    // const isDevelopment = process.env.NODE_ENV === "development";


    const resp = {
      isMaintenance: data?.maintenance_mode ?? false,
      maintenanceMessage: data?.maintenance_message ?? "",
      adminUserIds: [] as string[],
      systemCreatedAt: data?.created_at ?? null,
    };
    // if(isDevelopment) {
      resp.adminUserIds = data.admin_user_ids ?? [];
    // }
    return NextResponse.json(resp, { status: 200 });

  } catch (err) {
    console.error("Unexpected API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}