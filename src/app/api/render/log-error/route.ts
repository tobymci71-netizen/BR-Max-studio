import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export interface ClientErrorPayload {
  jobId: string | null;
  errorType: string;
  stage: string;
  userMessage: string;
  errorTitle: string | null;
  debugMessage: string;
  errorStack: string | null;
  propsSnapshot: Record<string, unknown> | null;
  audioProgress: number | null;
  audioGenerated: number | null;
  audioTotal: number | null;
  backgroundUploadProgress: number | null;
  elevenLabsKeyPrefix: string | null;
  voiceIdsUsed: string[] | null;
  monetizationEnabled: boolean | null;
  customBackgroundUsed: boolean | null;
  messageCount: number | null;
  extraContext: Record<string, unknown>;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload: ClientErrorPayload = await request.json();
    const browserInfo = request.headers.get("user-agent") || null;

    const errorData = {
      user_id: userId,
      job_id: payload.jobId || null,
      error_type: payload.errorType || "UnknownError",
      error_source: "client" as const,
      stage: payload.stage || "unknown",
      error_message: payload.userMessage || "Unknown error occurred",
      error_title: payload.errorTitle || null,
      debug_message: payload.debugMessage || "No debug message available",
      error_stack: payload.errorStack || null,
      browser_info: browserInfo,
      props_snapshot: payload.propsSnapshot || null,
      audio_progress: payload.audioProgress ?? null,
      audio_generated: payload.audioGenerated ?? null,
      audio_total: payload.audioTotal ?? null,
      background_upload_progress: payload.backgroundUploadProgress ?? null,
      eleven_labs_key_prefix: payload.elevenLabsKeyPrefix || null,
      voice_ids_used: payload.voiceIdsUsed || null,
      monetization_enabled: payload.monetizationEnabled ?? null,
      custom_background_used: payload.customBackgroundUsed ?? null,
      message_count: payload.messageCount ?? null,
      context: payload.extraContext || {},
      created_at: new Date().toISOString(),
    };

    const { error: insertError } = await supabaseAdmin
      .from("render_errors")
      .insert(errorData);

    if (insertError) {
      console.error("Failed to log client error:", insertError);
      return NextResponse.json(
        { error: "Failed to log error" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error in log-error endpoint:", err);
    return NextResponse.json(
      { error: "Failed to process error log" },
      { status: 500 }
    );
  }
}
