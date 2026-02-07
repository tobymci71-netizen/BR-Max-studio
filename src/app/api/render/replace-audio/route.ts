import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { parseBuffer } from "music-metadata";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const s3 = new S3Client({
  region: process.env.NEXT_PUBLIC_AWS_REGION!,
  credentials: {
    accessKeyId: process.env.REMOTION_AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.REMOTION_AWS_SECRET_ACCESS_KEY!,
  },
});

type CompositionMessage = {
  id?: string;
  text?: string;
  audioPath?: string;
  audio_path?: string;
  audio_type?: string;
  audioDuration?: number;
};
type CompositionProps = { messages?: CompositionMessage[] };

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const {
      jobId,
      audioId,
      base64Data,
      mimeType = "audio/mpeg",
      updatedText,
      duration,
      audioType,
    } = await request.json();

    if (!jobId || !audioId || !base64Data) {
      return NextResponse.json(
        { error: "jobId, audioId and base64Data are required" },
        { status: 400 },
      );
    }

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
      ? [...props.messages]
      : [];

    const idx = messages.findIndex(
      (m, index) => (m?.id as string) === audioId || String(index) === audioId,
    );
    if (idx === -1) {
      return NextResponse.json(
        { error: "Audio message not found in composition props" },
        { status: 404 },
      );
    }

    const msg = messages[idx];
    const url: string | undefined =
      (msg?.audioPath as string) || (msg?.audio_path as string);

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Audio URL not found for this message" },
        { status: 400 },
      );
    }

    const bucket = process.env.NEXT_PUBLIC_AWS_BUCKET!;
    const region = process.env.NEXT_PUBLIC_AWS_REGION!;
    const prefix = `https://${bucket}.s3.${region}.amazonaws.com/`;

    if (!url.startsWith(prefix)) {
      return NextResponse.json(
        { error: "Audio URL does not match expected bucket" },
        { status: 400 },
      );
    }

    const key = url.slice(prefix.length); // keep EXACT same key
    const buffer = Buffer.from(base64Data, "base64");

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    );

    // Re-calculate duration from the new audio file so it's always correct (upload or regenerate)
    let resolvedDuration: number | undefined;
    try {
      const meta = await parseBuffer(new Uint8Array(buffer), { mimeType });
      if (typeof meta.format?.duration === "number" && meta.format.duration > 0) {
        resolvedDuration = Number(meta.format.duration.toFixed(2));
      }
    } catch {
      // fallback to client-provided duration if parsing fails
      if (typeof duration === "number") resolvedDuration = duration;
    }
    if (resolvedDuration == null && typeof duration === "number") {
      resolvedDuration = duration;
    }

    // Update composition props: text, duration (from new file), and audio_type
    const hasUpdates =
      typeof updatedText === "string" ||
      resolvedDuration != null ||
      typeof audioType === "string";
    if (hasUpdates) {
      if (typeof updatedText === "string") {
        messages[idx].text = updatedText;
      }
      if (resolvedDuration != null) {
        messages[idx].audioDuration = resolvedDuration;
      }
      if (typeof audioType === "string") {
        messages[idx].audio_type = audioType;
      }
      const nextProps = { ...props, messages };
      await supabaseAdmin
        .from("render_jobs")
        .update({ composition_props: nextProps })
        .eq("id", jobId)
        .eq("user_id", userId);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Replace audio error:", err);
    return NextResponse.json(
      { error: "Failed to replace audio" },
      { status: 500 },
    );
  }
}

