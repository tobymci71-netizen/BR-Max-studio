import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { validateAndHoldTokens } from "@/helpers/tokenOperations";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { messages, hasCustomBackground = false, usesMonetization = false } = await request.json();

    // Create a placeholder job for the hold
    const utcStart = new Date().toISOString();
    const { data: job, error: jobError } = await supabaseAdmin
      .from("render_jobs")
      .insert({
        user_id: userId,
        job_id: crypto.randomUUID() + "_to_be_changed",
        status: "processing",
        stage: "audio",
        utc_start: utcStart,
      })
      .select()
      .single();

    if (jobError || !job) {
      console.error("render_jobs insert error:", jobError);
      return NextResponse.json(
        { error: "Failed to create token hold" },
        { status: 500 }
      );
    }

    const { error: updErr } = await supabaseAdmin
      .from("render_jobs")
      .update({ job_id: job.id })
      .eq("id", job.id)
      .eq("user_id", userId);

    if (updErr) {
      // Not fatal for holding tokens; log and continue
      console.warn("render_jobs job_id update warning:", updErr);
    }

    // Hold tokens
    const tokenCheck = await validateAndHoldTokens(
      userId,
      job.id,
      messages,
      hasCustomBackground,
      usesMonetization
    );

    if (!tokenCheck.success) {
      // Delete the placeholder job if token hold fails
      await supabaseAdmin.from("render_jobs").delete().eq("id", job.id).eq("user_id", userId);

      return NextResponse.json(
        {
          error: tokenCheck.error,
          tokensNeeded: tokenCheck.tokensNeeded,
          availableTokens: tokenCheck.availableTokens,
        },
        { status: 402 }
      );
    }

    return NextResponse.json({
      success: true,
      jobId: job.id,
      tokensHeld: tokenCheck.tokensHeld,
    });
  } catch (err) {
    console.error("Token hold error:", err);
    return NextResponse.json({ error: "Failed to hold tokens" }, { status: 500 });
  }
}
