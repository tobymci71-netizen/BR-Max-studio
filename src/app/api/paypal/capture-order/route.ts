import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { addTokenTransaction } from "@/lib/tokenTransactions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { capturePaypalOrder, getPaypalOrder } from "../paypalUtil"; // Import getPaypalOrder

const parseCustomIdValue = (customId: string, key: string) => {
  if (!customId) return null;
  return customId
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${key}:`))
    ?.slice(key.length + 1);
};

export async function POST(request: Request) {
  try {
    console.log("🔵 PayPal capture-order endpoint called");

    // 1. Request Validation
    const { orderId } = await request.json();
    if (!orderId) {
      console.error("❌ Missing orderId in request");
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    console.log("📝 Processing PayPal Order ID:", orderId);

    // 2. Capture the Order FIRST (before auth check)
    // This ensures we capture the payment even if user isn't logged in
    console.log("💳 Attempting to capture PayPal payment...");
    const captureData = await capturePaypalOrder(orderId);
    console.log("✅ PayPal payment captured successfully - Capture ID:", captureData.id);

    // 3. Check Status
    if (captureData.status !== "COMPLETED") {
      return NextResponse.json({ error: "Payment not completed" }, { status: 400 });
    }

    // 4. Extract Payment Details (Amount, Payer)
    const purchaseUnit = captureData.purchase_units?.[0];
    const capture = purchaseUnit?.payments?.captures?.[0]; // The money movement

    const amount = capture?.amount?.value || purchaseUnit?.amount?.value || "0.00";
    const currency = capture?.amount?.currency_code || "USD";
    const payerEmail = captureData.payer?.email_address;
    const payerName = captureData.payer?.name?.given_name || "Customer";
    const timestamp = new Date(capture?.create_time || captureData.create_time);

    // 5. RETRIEVE METADATA
    // First, try finding custom_id in the capture response
    let customId = purchaseUnit?.custom_id;

    // If missing, fetch the original Order details which DEFINITELY has it
    if (!customId) {
        console.log("Custom ID missing in capture response, fetching Order Details...");
        const orderDetails = await getPaypalOrder(orderId);
        customId = orderDetails.purchase_units?.[0]?.custom_id;
    }

    // 6. Parse Metadata
    const tokens = Number(parseCustomIdValue(customId || "", "tokens") || 0);
    const encodedUserId = parseCustomIdValue(customId || "", "uid");
    const packageId = parseCustomIdValue(customId || "", "package_id");

    if (!Number.isInteger(tokens) || tokens <= 0) {
       console.error("Invalid Tokens Detected:", { tokens, customId });
       return NextResponse.json({ error: "Invalid token metadata" }, { status: 400 });
    }

    if (!encodedUserId) {
       console.error("Missing user ID in order metadata:", { customId });
       return NextResponse.json({ error: "Invalid order metadata" }, { status: 400 });
    }

    // 7. Auth Check (moved after capture)
    // Now check if user is logged in
    const user = await currentUser();
    const userId = user?.id;
    const userEmail = user?.emailAddresses?.[0]?.emailAddress;

    // 8. Detect Auth Issues
    let authError: string | null = null;

    if (!userId) {
      authError = "User not logged in during payment capture. Please contact support with your transaction ID to credit your tokens.";
      console.warn("Auth Issue - No logged-in user:", { orderId, encodedUserId, captureId: captureData.id });
    } else if (encodedUserId !== userId) {
      authError = "User mismatch - this order belongs to a different account. Please contact support.";
      console.warn("Auth Issue - User mismatch:", { orderId, encodedUserId, currentUserId: userId, captureId: captureData.id });
    }

    // Use encodedUserId from order for database entry
    const targetUserId = encodedUserId;

    // 9. Generate Internal Transaction ID
    const shortUid = targetUserId.slice(-6).toUpperCase();
    const timeStr = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const transactionId = `TXN-${shortUid}-${timeStr}${random}`;

    // 10. Idempotency Check
    console.log("🔍 Checking for duplicate payment processing...");
    const { data: existing } = await supabaseAdmin
      .from("payment_logs")
      .select("transaction_id, error_message")
      .eq("provider_payment_id", captureData.id)
      .maybeSingle();

    if (existing?.transaction_id) {
      console.log("⚠️ Payment already processed - Transaction ID:", existing.transaction_id);
      return NextResponse.json({
        success: !existing.error_message, // success is false if there was an error
        transactionId: existing.transaction_id,
        status: "ALREADY_PROCESSED",
        alreadyProcessed: true,
        error: existing.error_message || undefined,
        paymentInfo: {
            amount,
            tokens,
            payerName,
            payerEmail,
            timestamp: timestamp.toLocaleString(),
            balance: 0 // We don't know new balance here easily, that's fine
        }
      });
    }

    console.log("✅ No duplicate found - Proceeding with new transaction:", transactionId);

    // 11. Database Write 1: Payment Log (always save, even with auth errors)
    const { error: logError } = await supabaseAdmin.from("payment_logs").insert({
      user_id: targetUserId,
      transaction_id: transactionId,
      provider: "paypal",
      provider_order_id: orderId,
      provider_payment_id: captureData.id, // The capture ID
      amount: amount,
      currency: currency,
      status: captureData.status.toLowerCase(),
      payer_email: payerEmail,
      raw_data: captureData,
      error_message: authError, // Store auth error if any
      ...(packageId && { package_id: packageId }),
    });

    if (logError) {
      console.error("❌ CRITICAL: Failed to create payment_logs entry");
      console.error("Transaction ID:", transactionId);
      console.error("PayPal Order ID:", orderId);
      console.error("PayPal Capture ID:", captureData.id);
      console.error("User ID:", targetUserId);
      console.error("Amount:", amount, currency);
      console.error("Full Error Object:", JSON.stringify(logError, null, 2));
      console.error("Error Code:", logError.code);
      console.error("Error Message:", logError.message);
      console.error("Error Details:", logError.details);
      console.error("Error Hint:", logError.hint);

      throw new Error(`CRITICAL PAYMENT_LOGS FAILURE: ${logError.message} (Code: ${logError.code})`);
    }

    console.log("✅ Payment log created successfully:", transactionId);

    // 12. If auth error, return early WITHOUT crediting tokens or sending email
    if (authError) {
      console.error("Payment captured but not credited due to auth issue:", {
        transactionId,
        orderId,
        captureId: captureData.id,
        authError
      });

      return NextResponse.json({
        success: false,
        transactionId,
        status: "CAPTURED_WITH_ERROR",
        error: authError,
        paymentInfo: {
          amount,
          tokens,
          payerName,
          payerEmail,
          timestamp: timestamp.toLocaleString(),
          balance: 0
        },
      });
    }

    // 13. Database Write 2: Token Ledger (only if no auth error)
    const transactionResult = await addTokenTransaction({
      userId: targetUserId,
      type: "token_purchase",
      amount: tokens,
      description: `PayPal purchase of ${tokens} tokens`,
      metadata: {
        transaction_id: transactionId,
        paypal_order_id: orderId,
        method: "PayPal",
        ...(packageId && { package_id: packageId }),
      },
    });

    if (!transactionResult.success) {
      console.error("❌ CRITICAL: Failed to create token_transaction");
      console.error("Transaction ID:", transactionId);
      console.error("User ID:", targetUserId);
      console.error("Tokens:", tokens);
      console.error("Payment was captured and payment_logs was created, but token crediting failed");
      console.error("MANUAL INTERVENTION REQUIRED - Customer paid but didn't receive tokens");

      throw new Error(`CRITICAL TOKEN_TRANSACTION FAILURE: Failed to credit ${tokens} tokens to user ${targetUserId}`);
    }

    console.log("✅ Token transaction created successfully:", transactionId, "- New Balance:", transactionResult.newBalance);

    // 14. Send Email (only if no auth error)
    const targetEmail = userEmail || payerEmail;
    if (targetEmail) {
      console.log("📧 Sending payment success email to:", targetEmail);
      try {
        // await sendPaymentSuccessEmail({
        //   to: targetEmail,
        //   amount,
        //   tokens,
        //   transactionId,
        //   payerName,
        //   currency,
        //   timestamp: timestamp.toLocaleString(),
        //   paymentMethod: "PayPal"
        // });
        console.log("✅ Email sent successfully");
      } catch (emailError) {
        console.error("⚠️ Failed to send email (non-critical):", emailError);
        // Don't throw - email failure shouldn't break payment flow
      }
    } else {
      console.warn("⚠️ No email address available - skipping email notification");
    }

    // 15. Success Response
    console.log("🎉 Payment processing completed successfully:", transactionId);
    return NextResponse.json({
      success: true,
      transactionId,
      status: captureData.status,
      paymentInfo: {
        amount,
        tokens,
        payerName,
        payerEmail: targetEmail,
        timestamp: timestamp.toLocaleString(),
        balance: transactionResult.newBalance,
      },
    });

  } catch (error) {
    console.error("❌❌❌ CRITICAL PayPal Capture Error ❌❌❌");
    console.error("Error Type:", error instanceof Error ? error.constructor.name : typeof error);
    console.error("Error Message:", error instanceof Error ? error.message : String(error));
    console.error("Error Stack:", error instanceof Error ? error.stack : "No stack trace available");
    console.error("Full Error Object:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    console.error("Timestamp:", new Date().toISOString());

    // If this is a database error related to payment_logs or token_transaction, it's critical
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("PAYMENT_LOGS") || errorMessage.includes("TOKEN_TRANSACTION")) {
      console.error("🚨🚨🚨 DATABASE FAILURE IN PAYMENT FLOW - MANUAL INTERVENTION REQUIRED 🚨🚨🚨");
    }

    return NextResponse.json({
      error: "Failed to capture order",
      details: process.env.NODE_ENV === "development" ? errorMessage : undefined
    }, { status: 500 });
  }
}
