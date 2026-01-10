if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
  throw new Error("Missing PayPal credentials");
}

if (!process.env.NEXT_PUBLIC_BASE_URL) {
  throw new Error("Missing NEXT_PUBLIC_BASE_URL");
}

const PAYPAL_BASE_URL =
  process.env.PAYPAL_MODE === "test"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";

let PAYPAL_ACCESS_TOKEN = "";
let TOKEN_EXPIRY = 0;

export const getPaypalAccessToken = async () => {
  if (PAYPAL_ACCESS_TOKEN && Date.now() < TOKEN_EXPIRY) {
    return PAYPAL_ACCESS_TOKEN;
  }

  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`,
  ).toString("base64");

  const res = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const errData = await res.text();
    console.error("PayPal Token Error:", errData);
    throw new Error("Failed to fetch PayPal access token");
  }

  const data = await res.json();
  PAYPAL_ACCESS_TOKEN = data.access_token;
  TOKEN_EXPIRY = Date.now() + (data.expires_in - 60) * 1000;
  return PAYPAL_ACCESS_TOKEN;
};

// UPDATED: Accepts currency and packageId arguments
export const createPaypalOrder = async (
  amount: string,
  tokens: number,
  currency: string,
  userId: string,
  packageId?: string,
) => {
  const token = PAYPAL_ACCESS_TOKEN || (await getPaypalAccessToken());

  // Build custom_id with package_id if provided
  let customId = `tokens:${tokens};uid:${userId}`;
  if (packageId) {
    customId += `;package_id:${packageId}`;
  }

  const res = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: amount,
          },
          description: `${tokens} tokens`,
          custom_id: customId,
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
            brand_name: "BR-Max",
            locale: "en-US",
            landing_page: "LOGIN",
            shipping_preference: "NO_SHIPPING",
            user_action: "PAY_NOW",
            return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/payment-success`,
            cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/payment-cancel`,
          },
        },
      },
    }),
  });

  if (!res.ok) {
    const errData = await res.text();
    console.error("PayPal Create Order Error:", errData);
    throw new Error("Failed to create PayPal order");
  }

  const data = await res.json();
  return data;
};

export const getPaypalOrder = async (orderId: string) => {
  const token = PAYPAL_ACCESS_TOKEN || (await getPaypalAccessToken());

  const res = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errData = await res.text();
    console.error("PayPal Get Order Error:", errData);
    throw new Error("Failed to fetch PayPal order details");
  }

  return await res.json();
};


export const capturePaypalOrder = async (orderId: string) => {
  const token = PAYPAL_ACCESS_TOKEN || (await getPaypalAccessToken());

  const res = await fetch(
    `${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!res.ok) {
    const errData = await res.text();
    console.error("PayPal Capture Error:", errData);
    throw new Error("Failed to capture PayPal order");
  }

  const data = await res.json();
  return data;
};
