interface SubscriptionEmailParams {
  to: string;
  type: 
    | "subscription_started" 
    | "subscription_renewed" 
    | "subscription_canceled" 
    | "payment_failed";
  tokens?: number;
  subscriptionId?: string;
  packageName?: string;
  amount?: string;
  nextBillingDate?: string;
  failureReason?: string;
}

export async function sendSubscriptionEmail(params: SubscriptionEmailParams) {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/send-subscription-email`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      },
    );

    if (!response.ok) {
      console.warn("Subscription email API returned error:", response.status);
    }
  } catch (error) {
    console.error("Failed to trigger subscription email:", error);
  }
}