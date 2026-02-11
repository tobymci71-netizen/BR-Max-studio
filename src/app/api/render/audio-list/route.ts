import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type AudioItem = {
  id: string;
  index: number;
  text: string;
  url: string;
  audioType: string;
};

type CompositionMessage = {
  id?: string;
  text?: string;
  audioPath?: string;
  audio_path?: string;
  audio_type?: string;
};

type JobVoiceSettings = {
  speed?: number;
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
};

type CompositionProps = {
  messages?: CompositionMessage[];
  voiceSettings?: JobVoiceSettings;
  enableSilenceTrimming?: boolean;
  silenceTrimmingType?: "full_audio" | "start_and_end";
  voices?: Array<{ name?: string; voiceId?: string }>;
};

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  try {
    const { data: job, error } = await supabaseAdmin
      .from("render_jobs")
      .select("id, user_id, composition_props")
      .eq("id", jobId)
      .eq("user_id", userId)
      .single();

    if (error || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const props = job.composition_props as CompositionProps;
    const messages: CompositionMessage[] = Array.isArray(props?.messages)
      ? props.messages
      : [];

    const items: AudioItem[] = [];

    messages.forEach((msg, index) => {
      const url = msg?.audioPath || msg?.audio_path;
      if (!url || typeof url !== "string" || !url.trim()) return;

      const text: string = typeof msg?.text === "string" ? msg.text : "";
      const audioType: string =
        typeof msg?.audio_type === "string" ? msg.audio_type : "original";

      items.push({
        id: (msg?.id as string) || String(index),
        index,
        text,
        url,
        audioType,
      });
    });

    // Job composition settings used at generation time (for modal defaults)
    const vs = props?.voiceSettings;
    const voiceSettings =
      vs && typeof vs === "object"
        ? {
            speed: typeof vs.speed === "number" ? vs.speed : undefined,
            stability: typeof vs.stability === "number" ? vs.stability : undefined,
            similarity_boost:
              typeof vs.similarity_boost === "number"
                ? vs.similarity_boost
                : undefined,
            style: typeof vs.style === "number" ? vs.style : undefined,
            use_speaker_boost:
              typeof vs.use_speaker_boost === "boolean"
                ? vs.use_speaker_boost
                : undefined,
          }
        : undefined;
    const enableSilenceTrimming =
      typeof props?.enableSilenceTrimming === "boolean"
        ? props.enableSilenceTrimming
        : undefined;
    const silenceTrimmingType =
      props?.silenceTrimmingType === "full_audio" ||
      props?.silenceTrimmingType === "start_and_end"
        ? props.silenceTrimmingType
        : undefined;
    const voices = Array.isArray(props?.voices) ? props.voices : [];
    const voiceId =
      voices.length > 0 && typeof voices[0]?.voiceId === "string"
        ? voices[0].voiceId
        : undefined;

    return NextResponse.json({
      items,
      voiceSettings: voiceSettings ?? undefined,
      enableSilenceTrimming,
      silenceTrimmingType: silenceTrimmingType ?? undefined,
      voiceId: voiceId ?? undefined,
    });
  } catch (err) {
    console.error("Failed to load audio list:", err);
    return NextResponse.json(
      { error: "Failed to load audio list" },
      { status: 500 },
    );
  }
}

