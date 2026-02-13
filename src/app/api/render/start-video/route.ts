import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CONFIRMATION_AND_VIDEO_AVAILABILITY_MS } from "@/types/constants";
import {
  renderMediaOnLambda,
  speculateFunctionName,
} from "@remotion/lambda/client";
import { AwsRegion } from "@remotion/lambda/client";
import { DISK, RAM, REGION, TIMEOUT } from "../../../../../config.mjs";

async function logErrorToSupabase(
  userId: string,
  jobId: string | null,
  errorType: string,
  userMessage: string,
  debugMessage: string,
  context?: Record<string, unknown>
) {
  try {
    await supabaseAdmin.from("render_errors").insert({
      user_id: userId,
      job_id: jobId,
      error_type: errorType,
      error_source: "server",
      stage: "starting_video",
      error_message: userMessage || "Unknown error",
      error_title: null,
      debug_message: debugMessage || "No debug message",
      error_stack: (context?.stack as string) ?? null,
      browser_info: null,
      props_snapshot: (context?.body as Record<string, unknown>) ?? null,
      audio_progress: null,
      audio_generated: null,
      audio_total: null,
      background_upload_progress: null,
      eleven_labs_key_prefix: null,
      voice_ids_used: null,
      monetization_enabled: null,
      custom_background_used: null,
      message_count: null,
      context: context ?? {},
      created_at: new Date().toISOString(),
    });
  } catch (logError) {
    console.error("Failed to log error to Supabase:", logError);
  }
}

/**
 * Starts video generation (Lambda render) for a job after user has confirmed audio.
 * Call with jobId and optional background info (s3Key, backgroundName).
 * Job must already have composition_props saved (e.g. via save-composition-props after audio upload).
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  const uid = userId;
  if (!uid) {
    return NextResponse.json(
      {
        error: "Authentication required",
        message: "Please sign in to start video generation",
      },
      { status: 401 }
    );
  }

  let jobId: string | null = null;
  try {
    const body = await request.json();
    const { jobId: bodyJobId, s3Key, backgroundName } = body;
    jobId = bodyJobId;

    if (!jobId) {
      return NextResponse.json(
        { error: "jobId is required" },
        { status: 400 }
      );
    }

    const { data: job, error: fetchError } = await supabaseAdmin
      .from("render_jobs")
      .select("id, composition_props, stage, utc_start")
      .eq("id", jobId)
      .eq("user_id", uid)
      .single();

    if (fetchError || !job) {
      return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
    }

    // Enforce confirmation window: user must start video within 2 hours of job start (audio phase)
    if (job.utc_start) {
      const startMs = new Date(job.utc_start).getTime();
      if (Date.now() - startMs > CONFIRMATION_AND_VIDEO_AVAILABILITY_MS) {
        return NextResponse.json(
          {
            error: "Confirmation window expired",
            message: "The time to review audio and start video has passed. Please create a new render.",
          },
          { status: 410 }
        );
      }
    }

    const props = job.composition_props as Record<string, unknown> | null;
    if (!props) {
      return NextResponse.json(
        {
          error: "Job has no composition props",
          message: "Save composition props (e.g. after audio upload) before starting video.",
        },
        { status: 400 }
      );
    }

    // Resolve background video URL (same logic as original render route)
    let backgroundVideoUrl: string;
    if (s3Key && typeof s3Key === "string" && s3Key.startsWith("uploads/")) {
      backgroundVideoUrl = `https://${process.env.NEXT_PUBLIC_AWS_BUCKET}.s3.${process.env.NEXT_PUBLIC_AWS_REGION}.amazonaws.com/${s3Key}`;
    } else if (backgroundName && typeof backgroundName === "string") {
      backgroundVideoUrl = backgroundName;
    } else {
      // Default background
      const bucket = process.env.NEXT_PUBLIC_AWS_BUCKET;
      const region = process.env.NEXT_PUBLIC_AWS_REGION;
      backgroundVideoUrl = `https://${bucket}.s3.${region}.amazonaws.com/background_video.mp4`;
    }

    const inputProps = {
      ...props,
      backgroundVideo: backgroundVideoUrl,
    };

    console.log(`🚀 Starting Lambda render for job ${jobId} (stage: video)`);

    const result = await renderMediaOnLambda({
      codec: "h264",
      functionName: speculateFunctionName({
        diskSizeInMb: DISK,
        memorySizeInMb: RAM,
        timeoutInSeconds: TIMEOUT,
      }),
      deleteAfter: "1-day",
      region: REGION as AwsRegion,
      serveUrl: "br-max",
      composition: "MyComp",
      inputProps,
      privacy: "public",
      webhook: {
        url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/lambda-webhook`,
        secret: process.env.LAMBDA_WEBHOOK_SECRET || null,
      },
    });

    await supabaseAdmin
      .from("render_jobs")
      .update({
        status: "video_generation",
        stage: "video",
        lambda_render_id: result.renderId,
        lambda_bucket_name: result.bucketName,
      })
      .eq("id", jobId)
      .eq("user_id", uid);

    console.log(`✅ Lambda render started: ${result.renderId}`);

    return NextResponse.json({
      success: true,
      jobId,
      renderId: result.renderId,
      bucketName: result.bucketName,
      message: "Video rendering started successfully!",
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown error occurred";
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("💥 Start video API error:", err);

    await logErrorToSupabase(
      uid,
      jobId,
      "unexpected_error",
      "An unexpected error occurred",
      `Unexpected error in start-video API: ${message}`,
      { error: message, stack }
    );

    if (jobId) {
      await supabaseAdmin
        .from("render_jobs")
        .update({
          status: "failed",
          utc_end: new Date().toISOString(),
          error_message: message,
        })
        .eq("id", jobId)
        .eq("user_id", uid);
    }

    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        message:
          "Something went wrong while starting video generation. Please try again.",
        debug: { message, stack },
      },
      { status: 500 }
    );
  }
}
