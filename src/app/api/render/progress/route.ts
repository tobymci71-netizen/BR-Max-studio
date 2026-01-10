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

    // ✅ If audio is being generated, return audio progress
    if (job.status === "queued") {
      return NextResponse.json({
        status: "queued",
        stage: "generating_audio",
      });
    }

    // If job is done or failed, return from database
    if (job.status === "done" || job.status === "failed") {
      return NextResponse.json({
        status: job.status,
        stage: "completed",
        progress: job.status === "done" ? 100 : 0,
        s3_url: job.s3_url,
        error_message: job.error_message,
        utc_end: job.utc_end,
        done: job.status === "done",
      });
    }

    // ✅ If processing and has Lambda metadata, get video render progress
    if (
      job.status === "processing" &&
      job.lambda_render_id &&
      job.lambda_bucket_name
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
          status: progress.done ? "done" : "processing",
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
            status: "processing",
            stage: "rendering_video",
            progress: 5,
            done: false,
          });
        }

        // Log only truly unexpected issues
        console.error("Unexpected error getting Lambda progress:", lambdaError);

        return NextResponse.json({
          status: job.status ?? "processing",
          stage: "processing",
          progress: 50,
          done: false,
        });
      }
    }

    // Default fallback
    return NextResponse.json({
      status: job.status,
      stage: job.status === "processing" ? "processing" : "queued",
      progress: job.status === "processing" ? 50 : 0,
    });
  } catch (err) {
    console.error("Progress API error:", err);
    return NextResponse.json(
      { error: "Failed to get progress" },
      { status: 500 },
    );
  }
}
