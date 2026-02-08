import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Saves composition props (with audio URLs) to a render job after audio is uploaded to AWS.
 * Call this when stopping the flow after audio upload so the job can be used later for video generation.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { jobId, props } = await request.json();

    if (!jobId || !props) {
      return NextResponse.json(
        { error: "jobId and props are required" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("render_jobs")
      .update({
        composition_props: props,
        status: "awaiting_to_start_render",
      })
      .eq("id", jobId)
      .eq("user_id", userId);

    if (error) {
      return NextResponse.json({ error: "Invalid job ID or update failed" }, { status: 400 });
    }

    return NextResponse.json({ success: true, jobId });
  } catch (err) {
    console.error("Save composition props error:", err);
    return NextResponse.json(
      { error: "Failed to save composition props" },
      { status: 500 }
    );
  }
}
