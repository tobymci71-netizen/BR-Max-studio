import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { RENDER_STATUS_VALUES } from "@/types/schema";

const VALID_STATUSES = new Set(RENDER_STATUS_VALUES);

/**
 * Updates the status of a render job (e.g. audio_generation when client starts generating audio).
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { jobId, status } = await request.json();

    if (!jobId || !status) {
      return NextResponse.json(
        { error: "jobId and status are required" },
        { status: 400 }
      );
    }

    if (!VALID_STATUSES.has(status)) {
      return NextResponse.json(
        { error: "Invalid status value" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("render_jobs")
      .update({ status })
      .eq("id", jobId)
      .eq("user_id", userId);

    if (error) {
      return NextResponse.json(
        { error: "Invalid job ID or update failed" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, jobId, status });
  } catch (err) {
    console.error("Update status error:", err);
    return NextResponse.json(
      { error: "Failed to update status" },
      { status: 500 }
    );
  }
}
