import { NextResponse } from "next/server";
import { Buffer } from "node:buffer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

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
    const { dataUrl, fileName } = await req.json();
    if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
      return NextResponse.json(
        { error: "Invalid image data" },
        { status: 400 },
      );
    }

    const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!match) {
      return NextResponse.json(
        { error: "Invalid data URL format" },
        { status: 400 },
      );
    }

    const contentType = match[1];
    const base64 = match[2];
    const buffer = Buffer.from(base64, "base64");
    const objectKey = `uploads/rizz/${fileName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: objectKey,
      Body: buffer,
      ContentType: contentType,
    });
    await s3.send(command);

    return NextResponse.json({
      url: `https://${BUCKET}.s3.${REGION}.amazonaws.com/${objectKey}`,
      key: objectKey,
    });
  } catch (err: unknown) {
    console.error("Failed to upload rizz image:", err);
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Unknown error" }, { status: 500 });
  }
}
