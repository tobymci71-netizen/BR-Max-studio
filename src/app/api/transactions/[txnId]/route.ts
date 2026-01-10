import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(
  request: Request,
  props: { params: Promise<{ txnId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const params = await props.params;
    const { txnId } = params;

    // Fetch from the NEW payment_logs table
    const { data: log, error } = await supabaseAdmin
      .from("payment_logs")
      .select("*")
      .eq("user_id", userId)
      .eq("transaction_id", txnId)
      .single();

    if (error || !log) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // We also need the token count. 
    // Ideally, you store tokens in payment_logs too, but if not, 
    // we can grab it from the raw_data or a separate query.
    // Let's grab it from raw_data since we saved it there in previous steps implicitly
    // OR fetch from token_transactions.
    
    // Fast way: Check token_transactions for this txnId in metadata
    const { data: tokenTx } = await supabaseAdmin
        .from("token_transactions")
        .select("amount")
        .filter("metadata->>transaction_id", "eq", txnId)
        .single();

    return NextResponse.json({
      txnId: txnId,
      tokens: tokenTx?.amount || 0, 
      amount: log.amount,
      currency: log.currency,
      method: log.provider === "paypal" ? "PayPal" : "Razorpay",
      status: log.status,
      timestamp: log.created_at,
      payerEmail: log.payer_email,
    });

  } catch (error) {
    console.log("Error getting transaction details: ", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}