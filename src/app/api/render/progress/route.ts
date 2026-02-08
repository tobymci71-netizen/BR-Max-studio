// /app/api/render/progress/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { auth } from "@clerk/nextjs/server";
import { getRenderProgress } from "@remotion/lambda/client";
import { AwsRegion } from "@remotion/lambda/client";
import { speculateFunctionName } from "@remotion/lambda/client";
import { DISK, RAM, TIMEOUT, REGION } from "../../../../../config.mjs";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  try {
    const { data: job, error } = await supabaseAdmin
      .from("render_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", userId)
      .single();

    if (error || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // ✅ Pre-video stages (includes legacy "queued"): no Lambda yet
    const preVideoStatuses = ["queued", "processing", "audio_generation", "audio_uploaded", "awaiting_to_start_render"];
    if (preVideoStatuses.includes(job.status) && !job.lambda_render_id) {
      const stage =
        job.status === "queued"
          ? "generating_audio"
          : job.status === "audio_generation"
            ? "generating_audio"
            : job.status === "audio_uploaded"
              ? "audio_uploaded"
              : job.status === "awaiting_to_start_render"
                ? "awaiting_to_start_render"
                : "processing";
      return NextResponse.json({
        status: job.status,
        stage,
      });
    }

    // Terminal: done, video_generated, failed, cancelled
    if (["done", "video_generated", "failed", "cancelled"].includes(job.status)) {
      const done = job.status === "done" || job.status === "video_generated";
      return NextResponse.json({
        status: job.status,
        stage: "completed",
        progress: done ? 100 : 0,
        s3_url: job.s3_url,
        error_message: job.error_message,
        utc_end: job.utc_end,
        done,
      });
    }

    // ✅ Video generation: has Lambda metadata (new status or legacy "processing")
    if (
      job.lambda_render_id &&
      job.lambda_bucket_name &&
      (job.status === "video_generation" || job.status === "processing")
    ) {
      try {
        const progress = await getRenderProgress({
          renderId: job.lambda_render_id,
          bucketName: job.lambda_bucket_name,
          functionName: speculateFunctionName({
            diskSizeInMb: DISK,
            memorySizeInMb: RAM,
            timeoutInSeconds: TIMEOUT,
          }),
          region: REGION as AwsRegion,
        });

        const progressPercent = Math.round(
          (progress.overallProgress || 0) * 100,
        );

        return NextResponse.json({
          status: progress.done ? "video_generated" : "video_generation",
          stage: "rendering_video",
          progress: progressPercent,
          s3_url: progress.outputFile,
          done: progress.done,
          framesRendered: progress.framesRendered,
          chunks: progress.chunks,
          overallProgress: progress.overallProgress,
        });
      } catch (lambdaError) {
        const message =
          lambdaError instanceof Error
            ? lambdaError.message
            : typeof lambdaError === "object" && lambdaError !== null
              ? JSON.stringify(lambdaError)
              : String(lambdaError ?? "");

        // 🔇 Common harmless case: Lambda hasn't written progress JSON yet
        if (message.includes("Invalid JSON")) {
          return NextResponse.json({
            status: "video_generation",
            stage: "rendering_video",
            progress: 5,
            done: false,
          });
        }

        // Log only truly unexpected issues
        console.error("Unexpected error getting Lambda progress:", lambdaError);

        return NextResponse.json({
          status: job.status ?? "video_generation",
          stage: "rendering_video",
          progress: 50,
          done: false,
        });
      }
    }

    // Default fallback
    return NextResponse.json({
      status: job.status,
      stage: job.status === "video_generation" ? "rendering_video" : "processing",
      progress: job.status === "video_generation" ? 50 : 0,
    });
  } catch (err) {
    console.error("Progress API error:", err);
    return NextResponse.json(
      { error: "Failed to get progress" },
      { status: 500 },
    );
  }
}
