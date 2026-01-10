import { NextResponse } from "next/server";
import { getUsdExchangeRate } from "@/lib/exchangeRates";

export async function POST(request: Request) {
  try {
    const { target: rawTarget } = await request.json();
    const target = typeof rawTarget === "string" ? rawTarget.trim().toUpperCase() : "";

    if (!target) {
      return NextResponse.json(
        { rate: 1, error: "Missing or invalid target currency" },
        { status: 400 }
      );
    }

    const rate = await getUsdExchangeRate(target);
    return NextResponse.json({ rate });
  } catch (error) {
    console.error("Exchange Rate Error:", error);
    return NextResponse.json(
      {
        rate: 1,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
