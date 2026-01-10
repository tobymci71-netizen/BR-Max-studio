import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.NEXT_PUBLIC_AWS_REGION!,
  credentials: {
    accessKeyId: process.env.REMOTION_AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.REMOTION_AWS_SECRET_ACCESS_KEY!,
  },
});

const MAX_FILES_PER_REQUEST = 50;

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { audioFiles, jobId } = await request.json();

    type IncomingAudioFile = {
      index: number;
      base64Data: string;
      duration: number;
      prefix?: string;
      taskIndex?: number;
    };

    if (audioFiles.length > MAX_FILES_PER_REQUEST) {
      return NextResponse.json(
        {
          error: "batch_too_large",
          message: `Maximum ${MAX_FILES_PER_REQUEST} files per request`,
          suggestedBatchSize: Math.floor(MAX_FILES_PER_REQUEST * 0.8) // Suggest 80% of max
        },
        { status: 413 } // Payload Too Large
      );
    }

    const uploadedUrls: Array<{ index: number; url: string; duration: number; taskIndex?: number }> = [];

    for (const audioFile of audioFiles as IncomingAudioFile[]) {
      const { index, base64Data, duration, prefix, taskIndex } = audioFile;
      const audioIndex = typeof index === "number" ? index : 0;
      const prefixPart = prefix ? `${prefix}_` : "";
      const audioFileName = `${prefixPart}${jobId}_msg_${audioIndex}.mp3`;
      const s3Key = `audios/${audioFileName}`;

      const buffer = Buffer.from(base64Data, "base64");

      await s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.NEXT_PUBLIC_AWS_BUCKET!,
          Key: s3Key,
          Body: buffer,
          ContentType: "audio/mpeg",
        })
      );

      const audioUrl = `https://${process.env.NEXT_PUBLIC_AWS_BUCKET}.s3.${process.env.NEXT_PUBLIC_AWS_REGION}.amazonaws.com/${s3Key}`;

      uploadedUrls.push({ index: audioIndex, url: audioUrl, duration, taskIndex });
    }

    return NextResponse.json({
      success: true,
      audioUrls: uploadedUrls,
    });
  } catch (err) {
    console.error("Batch audio upload error:", err);
    return NextResponse.json(
      { error: "Failed to upload audio files" },
      { status: 500 }
    );
  }
}
