interface PaymentEmailParams {
  to: string;
  amount: string;
  tokens: number;
  transactionId: string;
  payerName: string;
  timestamp: string;
  currency?: string;
  paymentMethod: string;
}

export async function sendPaymentSuccessEmail(params: PaymentEmailParams) {
  try {
    // We call your internal API route to actually send the email
    // This prevents importing 'resend' or email libraries directly in edge functions if needed
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/send-email`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      },
    );

    if (!response.ok) {
      console.warn("Email API returned error:", response.status);
    }
  } catch (error) {
    // We catch error so it doesn't block the payment response
    console.error("Failed to trigger payment email:", error);
  }
}
