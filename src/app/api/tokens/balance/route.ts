import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getCurrentTokenBalance } from "@/lib/tokenTransactions";

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const balance = await getCurrentTokenBalance(userId);

    return NextResponse.json({
      balance,
      success: true,
    });
  } catch (error) {
    console.error("Error fetching token balance:", error);
    return NextResponse.json(
      { error: "Failed to fetch token balance", success: false },
      { status: 500 }
    );
  }
}
