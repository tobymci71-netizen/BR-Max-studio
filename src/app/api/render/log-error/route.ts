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
      job_id: payload.jobId,
      error_type: payload.errorType,
      error_source: "client" as const,
      stage: payload.stage,
      user_message: payload.userMessage,
      error_title: payload.errorTitle,
      debug_message: payload.debugMessage,
      error_stack: payload.errorStack,
      browser_info: browserInfo,
      props_snapshot: payload.propsSnapshot,
      audio_progress: payload.audioProgress,
      audio_generated: payload.audioGenerated,
      audio_total: payload.audioTotal,
      background_upload_progress: payload.backgroundUploadProgress,
      eleven_labs_key_prefix: payload.elevenLabsKeyPrefix,
      voice_ids_used: payload.voiceIdsUsed,
      monetization_enabled: payload.monetizationEnabled,
      custom_background_used: payload.customBackgroundUsed,
      message_count: payload.messageCount,
      context: payload.extraContext,
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
