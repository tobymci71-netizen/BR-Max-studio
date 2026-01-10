import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createPaypalOrder } from "../paypalUtil";
import { getUsdExchangeRate } from "@/lib/exchangeRates";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

interface PayPalLink {
  href: string;
  rel: string;
  method: string;
}

// PayPal supported currencies (22 currencies)
const SUPPORTED_CURRENCIES = [
  "USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CNY", "CHF", "SEK", "NZD",
  "NOK", "DKK", "PLN", "CZK", "HUF", "ILS", "MXN", "BRL", "MYR", "PHP",
  "TWD", "THB"
];

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized. Please login" }, { status: 401 });
    }

    const body = await request.json();
    const packageId = body.packageId;
    const currencyRaw =
      typeof body.currency === "string" ? body.currency.trim() : "";
    const currency = currencyRaw ? currencyRaw.toUpperCase() : "USD";

    if (!packageId) {
      return NextResponse.json(
        { error: "Package ID is required" },
        { status: 400 },
      );
    }

    // Validate currency is supported by PayPal
    if (!SUPPORTED_CURRENCIES.includes(currency)) {
      return NextResponse.json(
        { error: `Currency ${currency} is not supported. Supported currencies: ${SUPPORTED_CURRENCIES.join(", ")}, INR` },
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

    // Convert USD to requested currency
    const exchangeRate = await getUsdExchangeRate(currency);
    const calculatedAmount = priceUSD * exchangeRate;

    if (!Number.isFinite(calculatedAmount) || calculatedAmount <= 0) {
      throw new Error("Calculated amount is invalid");
    }

    const formattedAmount = calculatedAmount.toFixed(2);
    const order = await createPaypalOrder(
      formattedAmount,
      tokens,
      currency,
      userId,
      packageId,
    );

    const approvalUrl = order.links.find(
      (link: PayPalLink) => link.rel === "payer-action",
    )?.href;
    if (!approvalUrl) {
      throw new Error("No approval URL received from PayPal");
    }

    return NextResponse.json({
      orderId: order.id,
      approvalUrl,
      amount: formattedAmount,
      currency,
      tokens,
      packageId,
      packageName: packageData.name,
      exchangeRate,
      userId,
    });
  } catch (error) {
    console.error("PayPal Create Order Error:", error);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 },
    );
  }
}
