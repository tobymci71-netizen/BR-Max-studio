import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { auth } from "@clerk/nextjs/server";
import { RENDER_STATUS_CANCELLABLE } from "@/types/schema";

export const dynamic = "force-dynamic"; // no cache for mutations

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized@2" }, { status: 401 });
  }

  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId") || (await request.json().catch(() => null))?.jobId;
  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  // Load & assert ownership first
  const { data: job, error: fetchErr } = await supabaseAdmin
    .from("render_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", userId)
    .single();

  if (fetchErr || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Terminal states
  if (job.status === "done" || job.status === "video_generated") {
    return NextResponse.json(
      { status: "blocked", message: "Video already finished; cannot cancel.", job },
      { status: 409 },
    );
  }
  if (job.status === "failed") {
    return NextResponse.json(
      { status: "blocked", message: "Video has failed; nothing to cancel.", job },
      { status: 409 },
    );
  }
  if (job.status === "cancelled") {
    return NextResponse.json(
      { status: "success", message: "Video already cancelled.", job },
      { status: 200 },
    );
  }

  const { data: updated, error: updErr } = await supabaseAdmin
    .from("render_jobs")
    .update({
      status: "cancelled",
      utc_end: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("user_id", userId)
    .in("status", RENDER_STATUS_CANCELLABLE as unknown as string[])
    .select()
    .maybeSingle(); // <- does NOT throw when 0 rows matched

  if (updErr) {
    // True server error — surface it so UI can show the real cause
    return NextResponse.json(
      {
        status: "error",
        message: updErr.message || "Failed to cancel video",
        details: updErr.details ?? null,
      },
      { status: 500 },
    );
  }

  if (!updated) {
    // 0 rows matched: status changed OR not cancellable anymore
    const { data: current } = await supabaseAdmin
      .from("render_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", userId)
      .single();

    return NextResponse.json(
      {
        status: "blocked",
        message:
          "Could not cancel — job is not in a cancellable state anymore. Refresh and try again.",
        job: current ?? job,
      },
      { status: 409 },
    );
  }

  return NextResponse.json(
    { status: "success", message: "Video cancelled.", job: updated },
    { status: 200 },
  );
}