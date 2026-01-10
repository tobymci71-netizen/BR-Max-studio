import { NextResponse } from "next/server";
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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
    const { fileName, fileType, partCount } = await req.json();

    // 1️⃣ Start multipart upload
    const createCmd = new CreateMultipartUploadCommand({
      Bucket: BUCKET,
      Key: `uploads/${fileName}`,
      ContentType: fileType,
    });

    const { UploadId } = await s3.send(createCmd);
    if (!UploadId) throw new Error("Failed to start multipart upload");

    // 2️⃣ Generate pre-signed URLs for each part
    const urls = [];
    for (let i = 1; i <= partCount; i++) {
      const command = new UploadPartCommand({
        Bucket: BUCKET,
        Key: `uploads/${fileName}`,
        PartNumber: i,
        UploadId,
      });
      const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
      urls.push(signedUrl);
    }

    return NextResponse.json({
      uploadId: UploadId,
      urls,
      key: `uploads/${fileName}`,
    });
  } catch (err: unknown) {
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    console.error("❌ start-multipart error:", err);
    return NextResponse.json({ error: 'Unknown error' }, { status: 500 });
  }
}