import { handleJobCompletion } from "@/helpers/tokenOperations";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  console.log("🔔 Webhook received!");
  
  const body = await req.json();
  console.log("📦 Webhook payload:", JSON.stringify(body, null, 2));
  
  const { record, old_record } = body;
  
  const newStatus = record.status;
  const oldStatus = old_record?.status;
  
  console.log(`Status change: ${oldStatus} → ${newStatus}`);
  
  // Skip if status didn't change or not final
  if (newStatus === oldStatus || !["done", "failed"].includes(newStatus)) {
    console.log("⏭️ Skipped - not a final status change");
    return NextResponse.json({ skipped: true });
  }
  
  console.log(`🎯 Processing completion for job ${record.id}`);
  
  // Handle tokens
  const result = await handleJobCompletion(
    record.user_id,
    record.id,
    newStatus === "done"
  );
  
  console.log("✅ Token handling result:", result);
  
  return NextResponse.json({ success: true });
}