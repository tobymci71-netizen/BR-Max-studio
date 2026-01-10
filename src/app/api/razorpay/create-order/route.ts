import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getUsdExchangeRate } from "@/lib/exchangeRates";
import { razorpay } from "@/lib/razorpayClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized. Please login" }, { status: 401 });
    }

    const body = await request.json();
    const packageId = body.packageId;

    if (!packageId) {
      return NextResponse.json(
        { error: "Package ID is required" },
        { status: 400 },
      );
    }

    // Fetch the package from database
    const { data: packageData, error: packageError } = await supabaseAdmin
      .from('token_packages')
      .select('*')
      .eq('id', packageId)
      .single();

    if (packageError || !packageData) {
      console.error('Error fetching package:', packageError);
      return NextResponse.json(
        { error: 'Invalid package selected' },
        { status: 400 }
      );
    }

    const tokens = packageData.tokens;
    const priceUSD = packageData.priceUSD;
    const currency = "INR";

    // Convert USD to INR
    const exchangeRate = await getUsdExchangeRate(currency);
    const calculatedAmount = priceUSD * exchangeRate;

    if (!Number.isFinite(calculatedAmount) || calculatedAmount <= 0) {
      throw new Error("Calculated amount is invalid");
    }

    const amountInSmallestUnit = Math.round(calculatedAmount * 100);

    // CRITICAL: Razorpay rejects orders below ₹1 (100 paise)
    if (amountInSmallestUnit < 100) {
      return NextResponse.json(
        { error: "Minimum transaction amount is ₹1. Please select a different package." },
        { status: 400 },
      );
    }

    const options = {
      amount: amountInSmallestUnit,
      currency,
      receipt: `rcpt_${userId.slice(-10)}_${Date.now().toString().slice(-8)}`,
      notes: {
        tokens: tokens.toString(),
        uid: userId,
        type: "token_purchase",
        package_id: packageId,
      },
    };

    const order = await razorpay.orders.create(options);

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      amountFormatted: calculatedAmount.toFixed(2),
      tokens,
      packageId,
      packageName: packageData.name,
      // Sending Key ID here allows frontend to use data.key instead of process.env
      key: process.env.RAZORPAY_KEY_ID,
      exchangeRate,
    });
  } catch (error) {
    console.error("Razorpay Error:", error);
    return NextResponse.json(
      { error: "Failed to create Razorpay order" },
      { status: 500 },
    );
  }
}