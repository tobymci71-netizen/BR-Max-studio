import { NextResponse } from "next/server";
import {
  S3Client,
  CompleteMultipartUploadCommand,
} from "@aws-sdk/client-s3";

const REGION = process.env.NEXT_PUBLIC_AWS_REGION!;
const BUCKET = process.env.NEXT_PUBLIC_AWS_BUCKET!;

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.REMOTION_AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.REMOTION_AWS_SECRET_ACCESS_KEY!,
  },
});

export async function POST(req: Request) {
  try {
    const { fileName, uploadId, parts } = await req.json();
    const key = `uploads/${fileName}`;

    const completeCmd = new CompleteMultipartUploadCommand({
      Bucket: BUCKET,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    });

    await s3.send(completeCmd);

    const url = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;

    return NextResponse.json({
      message: "✅ Upload completed successfully!",
      key,
      url,
    });
  } catch (err: unknown) {
    if (err instanceof Error) {
    console.error("❌ complete-multipart error:", err);
    return NextResponse.json({ error: 'Unknown error' }, { status: 500 });
    }
  }
}