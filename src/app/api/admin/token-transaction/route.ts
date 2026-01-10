import { NextRequest, NextResponse } from "next/server";
import { addTokenTransaction } from "@/lib/tokenTransactions";
import { validateAdminAuth } from "@/lib/adminAuth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const auth = validateAdminAuth(payload);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const data = payload as Record<string, unknown>;
  const userId = typeof data.userId === "string" ? data.userId.trim() : "";
  const rawAmount = data.amount;
  const amount =
    typeof rawAmount === "number"
      ? rawAmount
      : typeof rawAmount === "string"
        ? Number(rawAmount)
        : NaN;
  const description = typeof data.description === "string" ? data.description.trim() : "";

  if (!userId) {
    return NextResponse.json({ error: "Missing user ID" }, { status: 400 });
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
  }

  try {
    const result = await addTokenTransaction({
      userId,
      amount,
      type: "admin_credit",
      description: description || "Admin token adjustment",
      metadata: { source: "admin-dashboard" },
    });

    if (!result.success) {
      return NextResponse.json({ error: "Failed to create token transaction" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, newBalance: result.newBalance });
  } catch (error) {
    console.error("[admin token transaction] Failed to add tokens", error);
    return NextResponse.json({ error: "Unable to add tokens" }, { status: 500 });
  }
}
