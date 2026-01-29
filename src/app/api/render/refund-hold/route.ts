import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { handleJobCompletion } from "@/helpers/tokenOperations";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { jobId, reason } = await request.json();
    if (!jobId || typeof jobId !== "string") {
      return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
    }

    const { data: job, error: jobError } = await supabaseAdmin
      .from("render_jobs")
      .select("id, user_id, status")
      .eq("id", jobId)
      .eq("user_id", userId)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (job.status === "done") {
      return NextResponse.json(
        { error: "Job already completed" },
        { status: 409 },
      );
    }

    const refundResult = await handleJobCompletion(userId, jobId, false);
    if (!refundResult.success) {
      return NextResponse.json(
        { error: refundResult.error || "Failed to refund tokens" },
        { status: 500 },
      );
    }

    const isUserCancellation = reason === "User cancelled generation";

    await supabaseAdmin
      .from("render_jobs")
      .update({
        status: isUserCancellation ? "cancelled" : "failed",
        utc_end: new Date().toISOString(),
        error_message: isUserCancellation
          ? "Generation cancelled before render was started"
          : reason || "Generation failed before render was started",
      })
      .eq("id", jobId)
      .eq("user_id", userId);

    return NextResponse.json({
      success: true,
      refunded: refundResult.tokensRefunded ?? 0,
      alreadyProcessed: refundResult.alreadyProcessed ?? false,
    });
  } catch (error) {
    console.error("Failed to refund held tokens:", error);
    return NextResponse.json(
      { error: "Failed to refund held tokens" },
      { status: 500 },
    );
  }
}
