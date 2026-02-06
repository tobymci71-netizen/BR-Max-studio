import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  AwsRegion,
  deleteRender,
  validateWebhookSignature,
  WebhookPayload,
} from "@remotion/lambda/client";
import { REGION } from "../../../../config.mjs";
import { getVideoMetadata } from "./calculateSizeAndDuration";

/**
 * Webhook handler for Remotion Lambda render completion
 * This is called by AWS Lambda when a render finishes
 */
export async function POST(request: Request) {
  try {
    const raw = await request.text();
    if (!raw || raw.trim().length === 0) {
      console.error("❌ Webhook received empty body");
      return NextResponse.json({ error: "Empty body" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      console.error("❌ Webhook body is not valid JSON:", raw.slice(0, 200));
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // const body = await request.json();

    // ✅ Validate webhook signature using Remotion's helper
    if (process.env.LAMBDA_WEBHOOK_SECRET) {
      const signatureHeader = request.headers.get("x-remotion-signature");

      if (!signatureHeader) {
        console.error("❌ Missing webhook signature");
        return NextResponse.json(
          { error: "Missing signature" },
          { status: 401 },
        );
      }

      try {
        validateWebhookSignature({
          secret: process.env.LAMBDA_WEBHOOK_SECRET,
          body: body,
          signatureHeader: signatureHeader,
        });
      } catch (err) {
        console.error("❌ Invalid webhook signature:", err);
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 },
        );
      }
    }

    // ✅ Type-safe webhook payload
    const payload = body as WebhookPayload;
    const { type, renderId, bucketName } = payload;

    console.log(`📥 Webhook received: "${type}" for render "${renderId}"`);

    // Find the job by lambda_render_id
    const { data: job, error: findError } = await supabaseAdmin
      .from("render_jobs")
      .select("*")
      .eq("lambda_render_id", renderId)
      .single();

    if (findError || !job) {
      console.error(`❌ Job not found for renderId: ${renderId}`);
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (job.status == "cancelled") {
      await deleteRender({
        bucketName: job.lambda_bucket_name,
        region: REGION as AwsRegion,
        renderId: job.lambda_render_id,
      });
      return NextResponse.json({
        success: true,
        jobId: job.id,
        error_message: "Video was cancelled by user.",
      });
    }

    const jobId = job.id;
    const utcEnd = new Date().toISOString();
    const utcStart = job.utc_start;
    const duration_sec =
      (new Date(utcEnd).getTime() - new Date(utcStart).getTime()) / 1000;

    // ========== HANDLE SUCCESS ==========
    if (type === "success" && payload.outputUrl) {
      let analytics = {};
      const outputUrl = payload.outputUrl;

      try {
        const meta = await getVideoMetadata(outputUrl);

        analytics = {
          output_duration_sec: meta.duration,
          output_size_bytes: meta.size,
        };
      } catch (err) {
        console.error("Metadata extraction failed:", err);
      }

      const s3_url = outputUrl

      await supabaseAdmin
        .from("render_jobs")
        .update({
          status: "video_generated",
          s3_url,
          webhook_payload: payload,
          utc_end: utcEnd,
          duration_sec,
          error_message: null,
          ...analytics,
        })
        .eq("id", jobId)
        .eq("user_id", job.user_id);

      return NextResponse.json({ success: true, jobId, s3_url });
    }

    // ========== HANDLE ERROR ==========
    if (type === "error") {
      // ✅ CORRECT: Use errors array from WebhookErrorPayload
      const errors = payload.errors;
      const errorMessage = errors
        ? errors.map((e) => `${e.name}: ${e.message}`).join("; ")
        : "Render failed without specific error";

      await supabaseAdmin
        .from("render_jobs")
        .update({
          status: "failed",
          utc_end: utcEnd,
          duration_sec,
          webhook_payload: payload,
          error_message: errorMessage,
        })
        .eq("id", jobId)
        .eq("user_id", job.user_id);

      await supabaseAdmin.from("render_errors").insert({
        user_id: job.user_id,
        job_id: jobId,
        error_type: "lambda_render_failed",
        error_source: "lambda",
        stage: "lambda_rendering",
        error_message: "Video rendering failed",
        error_title: "Render Failed",
        debug_message: errorMessage || "No debug message",
        error_stack: null,
        browser_info: null,
        props_snapshot: job.composition_props,
        audio_progress: 100,
        audio_generated: null,
        audio_total: null,
        background_upload_progress: 100,
        eleven_labs_key_prefix: null,
        voice_ids_used: null,
        monetization_enabled: null,
        custom_background_used: null,
        message_count: null,
        context: {
          renderId,
          bucketName,
          errors: errors || [],
          webhookPayload: payload,
          lambdaRenderDetails: job.render_details,
        },
        created_at: new Date().toISOString(),
      });

      console.error(`❌ Render failed: ${jobId}`);
      console.error(`Error: ${errorMessage}`);

      return NextResponse.json({ success: false, jobId, error: errorMessage });
    }

    // ========== HANDLE TIMEOUT ==========
    if (type === "timeout") {
      await supabaseAdmin
        .from("render_jobs")
        .update({
          status: "failed",
          utc_end: utcEnd,
          duration_sec,
          webhook_payload: payload,
          error_message: "Render timed out",
        })
        .eq("id", jobId)
        .eq("user_id", job.user_id);

      await supabaseAdmin.from("render_errors").insert({
        user_id: job.user_id,
        job_id: jobId,
        error_type: "lambda_timeout",
        error_source: "lambda",
        stage: "lambda_rendering",
        error_message: "Video rendering timed out",
        error_title: "Render Timeout",
        debug_message: "Lambda function exceeded maximum execution time",
        error_stack: null,
        browser_info: null,
        props_snapshot: job.composition_props,
        audio_progress: 100,
        audio_generated: null,
        audio_total: null,
        background_upload_progress: 100,
        eleven_labs_key_prefix: null,
        voice_ids_used: null,
        monetization_enabled: null,
        custom_background_used: null,
        message_count: null,
        context: {
          renderId,
          bucketName,
          lambdaRenderDetails: job.render_details,
        },
        created_at: new Date().toISOString(),
      });

      console.error(`⏱️ Render timed out: ${jobId}`);

      return NextResponse.json({ success: false, jobId, error: "Timeout" });
    }

    console.warn(`⚠️ Unknown webhook type: ${type}`);
    return NextResponse.json({
      success: false,
      error: "Unknown webhook type",
    });
  } catch (err) {
    console.error("💥 Webhook handler error:", err);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}
