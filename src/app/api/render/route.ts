import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  renderMediaOnLambda,
  speculateFunctionName,
} from "@remotion/lambda/client";
import { AwsRegion } from "@remotion/lambda/client";
import { DISK, RAM, REGION, TIMEOUT } from "../../../../config.mjs";

async function logErrorToSupabase(
  userId: string,
  jobId: string | null,
  errorType: string,
  userMessage: string,
  debugMessage: string,
  context?: Record<string, unknown>,
) {
  try {
    const errorData = {
      user_id: userId,
      job_id: jobId,
      error_type: errorType,
      error_source: "server",
      stage: "starting_render",
      error_message: userMessage || "Unknown error",
      error_title: null,
      debug_message: debugMessage || "No debug message",
      error_stack: context?.stack as string | null ?? null,
      browser_info: null,
      props_snapshot: context?.body as Record<string, unknown> | null ?? null,
      audio_progress: null,
      audio_generated: null,
      audio_total: null,
      background_upload_progress: null,
      eleven_labs_key_prefix: null,
      voice_ids_used: null,
      monetization_enabled: null,
      custom_background_used: null,
      message_count: null,
      context: context || {},
      created_at: new Date().toISOString(),
    };
    await supabaseAdmin.from("render_errors").insert(errorData);
  } catch (logError) {
    console.error("Failed to log error to Supabase:", logError);
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      {
        error: "Authentication required",
        message: "Please sign in to start rendering videos",
      },
      { status: 401 },
    );
  }

  let jobId: string | null = null;
  try {
    const body = await request.json();
    const { s3Key, props, backgroundName, jobId: bodyJobId } = body;
    jobId = bodyJobId;
    // Validation
    if (!props) {
      await logErrorToSupabase(
        userId,
        null,
        "validation_error",
        "Missing required information",
        "Missing props in request body",
        { body },
      );
      return NextResponse.json(
        {
          error: "Missing required information",
          message: "Please provide both file name and video properties",
        },
        { status: 400 },
      );
    }

    const { data: existingJob } = await supabaseAdmin
      .from("render_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", userId)
      .single();

    if (!existingJob) {
      return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
    }

    // Update supabase job with the composition props
    await supabaseAdmin.from("render_jobs").update({composition_props: props}).eq("id", jobId).eq("user_id", userId);

  
    // ========== BACKGROUND VIDEO ==========
    let backgroundVideoUrl: string;

    if (s3Key && s3Key.startsWith("uploads/")) {
      backgroundVideoUrl = `https://${process.env.NEXT_PUBLIC_AWS_BUCKET}.s3.${process.env.NEXT_PUBLIC_AWS_REGION}.amazonaws.com/${s3Key}`;
    } else {
      backgroundVideoUrl = backgroundName;
    }

    // ========== PREPARE FINAL INPUT PROPS ==========
    const inputProps = {
      ...props,
      backgroundVideo: backgroundVideoUrl,
    };

    console.log(`🚀 Starting Lambda render for job ${jobId}`);

    // ========== START LAMBDA RENDER ==========
    const result = await renderMediaOnLambda({
      codec: "h264",
      functionName: speculateFunctionName({
        diskSizeInMb: DISK,
        memorySizeInMb: RAM,
        timeoutInSeconds: TIMEOUT,
      }),
      deleteAfter: "1-day",
      // downloadBehavior: {"type": "download", fileName: null},
      region: REGION as AwsRegion,
      serveUrl: `br-max`,
      composition: "MyComp",
      inputProps,
      privacy: "public",
      webhook: {
        url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/lambda-webhook`,
        secret: process.env.LAMBDA_WEBHOOK_SECRET || null,
      },
    });

    // ========== UPDATE WITH LAMBDA METADATA ==========
    await supabaseAdmin
      .from("render_jobs")
      .update({
        status: "processing",
        lambda_render_id: result.renderId,
        lambda_bucket_name: result.bucketName,
        render_details: result
      })
      .eq("id", jobId)
      .eq("user_id", userId);

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
    console.error("💥 Render API error:", err);

    await logErrorToSupabase(
      userId,
      jobId,
      "unexpected_error",
      "An unexpected error occurred",
      `Unexpected error in render API: ${message}`,
      { error: message, stack },
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
        .eq("user_id", userId);
    }

    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        message:
          "Something went wrong while processing your request. Please try again.",
        debug: { message, stack },
      },
      { status: 500 },
    );
  }
}
