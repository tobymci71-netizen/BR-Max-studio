import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { razorpay } from "@/lib/razorpayClient";
import { addTokenTransaction } from "@/lib/tokenTransactions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const parseNotesValue = (notes: Record<string, unknown> | undefined, key: string) => {
  if (!notes) return null;
  const val = notes[key];
  return val ? String(val).trim() : null;
};

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    const userId = user?.id;
    const userEmail = user?.emailAddresses?.[0]?.emailAddress;

    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await request.json();
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: "Missing details" }, { status: 400 });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const [order, payment] = await Promise.all([
      razorpay.orders.fetch(razorpay_order_id),
      razorpay.payments.fetch(razorpay_payment_id),
    ]);

    const notes = (order.notes || {}) as Record<string, unknown>;
    const tokens = Number(parseNotesValue(notes, "tokens") || 0);
    const uid = parseNotesValue(notes, "uid");
    const packageId = parseNotesValue(notes, "package_id");
    const rawAmount = Number(order.amount) || 0;
    const amount = rawAmount / 100;

    if (uid && uid !== userId) return NextResponse.json({ error: "Mismatch" }, { status: 403 });

    const txnId = `TXN-${userId.slice(-6).toUpperCase()}-${Date.now().toString().slice(-6)}${Math.floor(Math.random()*1000)}`;

    let targetEmail = userEmail;
    if (!targetEmail && payment.email && !payment.email.includes("razorpay.com")) {
      targetEmail = payment.email;
    }

    const { data: existing } = await supabaseAdmin
      .from("payment_logs")
      .select("transaction_id")
      .eq("provider_payment_id", razorpay_payment_id)
      .maybeSingle();

    if (existing?.transaction_id) {
      return NextResponse.json({ success: true, transactionId: existing.transaction_id, alreadyProcessed: true });
    }

    await supabaseAdmin.from("payment_logs").insert({
      user_id: userId,
      transaction_id: txnId,
      provider: "razorpay",
      provider_order_id: razorpay_order_id,
      provider_payment_id: razorpay_payment_id,
      amount,
      currency: order.currency,
      status: "succeeded",
      payer_email: targetEmail,
      raw_data: payment as unknown,
      ...(packageId && { package_id: packageId }),
    });

    await addTokenTransaction({
      userId,
      type: "token_purchase",
      amount: tokens,
      description: `Razorpay purchase of ${tokens} tokens`,
      metadata: {
        transaction_id: txnId,
        method: "Razorpay",
        ...(packageId && { package_id: packageId }),
      },
    });

    // Send Email (Pass currency explicitly)
    // if (targetEmail) {
    //   await sendPaymentSuccessEmail({
    //     to: targetEmail,
    //     amount: amount.toFixed(2),
    //     currency: order.currency, // "INR", etc.
    //     tokens,
    //     transactionId: txnId,
    //     payerName: user?.firstName || "Customer",
    //     timestamp: timestamp.toLocaleString(),
    //     paymentMethod: "Razorpay",
    //   });
    // }

    return NextResponse.json({ success: true, transactionId: txnId });

  } catch (error) {
    console.error("Razorpay Error:", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}