import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobId, reason } = await req.json();

    if (!jobId || typeof jobId !== "string") {
      return NextResponse.json({ error: "Missing or invalid jobId" }, { status: 400 });
    }

    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      return NextResponse.json({ error: "Please provide a reason for flagging" }, { status: 400 });
    }

    // Verify the job belongs to the user
    const { data: job, error: fetchError } = await supabaseAdmin
      .from("render_jobs")
      .select("id, user_id, status")
      .eq("id", jobId)
      .eq("user_id", userId)
      .single();

    if (fetchError || !job) {
      return NextResponse.json(
        { error: "Job not found or access denied" },
        { status: 404 }
      );
    }

    // Update the job to mark it as flagged
    const { error: updateError } = await supabaseAdmin
      .from("render_jobs")
      .update({
        is_flagged_for_issue: true,
        reason_for_flag: reason.trim(),
      })
      .eq("id", jobId)
      .eq("user_id", userId);

    if (updateError) {
      console.error("Error flagging job:", updateError);
      return NextResponse.json(
        { error: "Failed to flag job" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Job flagged successfully. Video lifetime extended to 24 hours.",
    });
  } catch (error) {
    console.error("Error in flag endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
