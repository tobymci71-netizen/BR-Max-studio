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

    const props = job.composition_props as any;
    const messages: any[] = Array.isArray(props?.messages) ? props.messages : [];

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

    return NextResponse.json({ items });
  } catch (err) {
    console.error("Failed to load audio list:", err);
    return NextResponse.json(
      { error: "Failed to load audio list" },
      { status: 500 },
    );
  }
}

