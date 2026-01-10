// src/app/api/credits-check/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { checkTokenAvailability } from "@/helpers/tokenOperations";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { messages, hasCustomBackground, usesMonetization = false } = await req.json();

  const result = await checkTokenAvailability(userId, messages, hasCustomBackground, usesMonetization);

  return NextResponse.json({
    hasEnough: result.hasEnough,
    tokensNeeded: result.tokensNeeded,
    availableTokens: result.availableTokens,
  });
}
