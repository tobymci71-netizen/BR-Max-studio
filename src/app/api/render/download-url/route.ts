import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BUCKET = process.env.NEXT_PUBLIC_AWS_BUCKET!;
const REGION = process.env.NEXT_PUBLIC_AWS_REGION!;
const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.REMOTION_AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.REMOTION_AWS_SECRET_ACCESS_KEY!,
  },
});

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

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

  const { data: job, error } = await supabaseAdmin
    .from("render_jobs")
    .select("id, user_id, s3_url, utc_end, status")
    .eq("id", jobId)
    .eq("user_id", userId)
    .single();

  if (error || !job || !job.s3_url) {
    return NextResponse.json({ error: "Job or download not found" }, { status: 404 });
  }

  const done = job.status === "video_generated" || job.status === "done";
  if (!done) {
    return NextResponse.json({ error: "Video not ready" }, { status: 400 });
  }

  const now = Date.now();
  const endMs = job.utc_end ? new Date(job.utc_end).getTime() : 0;
  const expiryMs = endMs + TWO_HOURS_MS;
  if (now > expiryMs) {
    return NextResponse.json({ error: "Download link expired" }, { status: 410 });
  }

  const s3Url = job.s3_url as string;
  const prefix = `https://${BUCKET}.s3.${REGION}.amazonaws.com/`;
  if (s3Url.startsWith(prefix)) {
    const key = s3Url.slice(prefix.length);
    const signed = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: BUCKET, Key: key }),
      { expiresIn: 7200 },
    );
    return NextResponse.redirect(signed, 302);
  }

  return NextResponse.redirect(s3Url, 302);
}
