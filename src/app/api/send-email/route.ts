import { NextResponse } from "next/server";
import { Resend } from "resend";

interface EmailData {
  to: string;
  amount: string;
  tokens: number;
  transactionId: string;
  payerName: string;
  payerEmail?: string; // Made optional for flexibility
  timestamp: string;
  currency?: string; // Added for dynamic currency support
  paymentMethod?: string; // Optional, falls back to currency logic if missing
}

const isValidEmail = (email: string): boolean => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email) && email.length <= 254;
};

// Restored your helper
const formatPaymentProvider = (provider: string) => {
  if (!provider) return "Credit Card";
  const p = provider.toLowerCase();
  if (p.includes("paypal")) return "PayPal";
  if (p.includes("razor")) return "Razorpay";
  if (p.includes("stripe")) return "Stripe";
  if (p.includes("upi")) return "Razorpay UPI";
  return provider.charAt(0).toUpperCase() + provider.slice(1);
};

export async function POST(request: Request) {
  try {
    const emailData: EmailData = await request.json();
    // console.log("Email data: ", emailData);

    // 1. Basic Validation (Your Limits Restored)
    if (!isValidEmail(emailData.to)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    if (
      !Number.isInteger(emailData.tokens) ||
      emailData.tokens <= 0 ||
      emailData.tokens > 1000000
    ) {
      return NextResponse.json({ error: "Invalid tokens" }, { status: 400 });
    }

    const amount = parseFloat(emailData.amount);
    // Increased limit slightly to accommodate INR (e.g. ₹50,000 is common)
    if (isNaN(amount) || amount <= 0 || amount > 1000000) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    // 2. Sanitization (Your Logic Restored)
    const sanitize = (str: string) =>
      str ? str.slice(0, 500).replace(/[<>]/g, "") : "";
    emailData.payerName = sanitize(emailData.payerName || "Valued Customer");
    emailData.transactionId = sanitize(emailData.transactionId);
    emailData.timestamp = sanitize(emailData.timestamp);

    // Determine Provider Label
    let providerRaw = emailData.paymentMethod || "";
    if (!providerRaw) {
      // Fallback based on currency if method isn't explicitly sent
      providerRaw = emailData.currency === "INR" ? "Razorpay" : "PayPal";
    }
    const formattedProvider = formatPaymentProvider(sanitize(providerRaw));

    // 3. Data Formatting (Dynamic Currency Fix)
    const currencyCode = (emailData.currency || "USD").toUpperCase();

    const formattedAmount = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode, // Uses INR or USD based on input
      minimumFractionDigits: 2,
    }).format(amount);

    const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Confirmation</title>
  <!--[if mso]>
  <style>
    table {border-collapse: collapse;}
    td,th,div,p,a,h1,h2,h3,h4,h5,h6 {font-family: Arial, sans-serif;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        
        <!-- Main Card -->
        <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
          
          <!-- Logo Section -->
          <tr>
            <td align="center" style="padding: 40px 40px 24px 40px; background-color: #ffffff;">
              <img src="https://br-max.s3.ap-south-1.amazonaws.com/BR.png" alt="BR Max" width="56" height="56" style="display: block; border: 0; height: 56px; width: auto;" />
            </td>
          </tr>

          <!-- Success Header -->
          <tr>
            <td align="center" style="padding: 0 40px;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #18181b; letter-spacing: -0.5px;">Payment Successful</h1>
              <p style="margin: 8px 0 0 0; font-size: 15px; color: #71717a;">Hi ${emailData.payerName.split(" ")[0]}, thanks for your order!</p>
            </td>
          </tr>

          <!-- Hero: Tokens -->
          <tr>
            <td align="center" style="padding: 32px 40px;">
              <div style="background-color: #fafafa; border: 1px solid #e4e4e7; border-radius: 16px; padding: 24px; text-align: center;">
                <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 600; color: #71717a; text-transform: uppercase; letter-spacing: 1px;">Tokens Added</p>
                <p style="margin: 0; font-size: 42px; font-weight: 800; color: #18181b; line-height: 1;">+${emailData.tokens.toLocaleString()}</p>
              </div>
            </td>
          </tr>

          <!-- Receipt Details -->
          <tr>
            <td style="padding: 0 40px 32px 40px;">
              <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding: 16px 0; border-bottom: 1px solid #f4f4f5; font-size: 14px; color: #71717a;">Total Amount</td>
                  <td style="padding: 16px 0; border-bottom: 1px solid #f4f4f5; font-size: 16px; font-weight: 600; color: #18181b; text-align: right;">${formattedAmount}</td>
                </tr>
                <tr>
                  <td style="padding: 16px 0; border-bottom: 1px solid #f4f4f5; font-size: 14px; color: #71717a;">Payment Method</td>
                  <td style="padding: 16px 0; border-bottom: 1px solid #f4f4f5; font-size: 14px; color: #18181b; text-align: right;">${formattedProvider}</td>
                </tr>
                <tr>
                  <td style="padding: 16px 0; border-bottom: 1px solid #f4f4f5; font-size: 14px; color: #71717a;">Transaction ID</td>
                  <td style="padding: 16px 0; border-bottom: 1px solid #f4f4f5; font-size: 13px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: #18181b; text-align: right;">${emailData.transactionId}</td>
                </tr>
                <tr>
                  <td style="padding: 16px 0; border-bottom: 1px solid #f4f4f5; font-size: 14px; color: #71717a;">Date</td>
                  <td style="padding: 16px 0; border-bottom: 1px solid #f4f4f5; font-size: 14px; color: #18181b; text-align: right;">${emailData.timestamp}</td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #fafafa; padding: 32px 40px; border-top: 1px solid #f4f4f5;">
              <p style="margin: 0 0 16px 0; font-size: 12px; line-height: 20px; color: #a1a1aa; text-align: center;">
                If you have any questions, please contact us on Discord with your Transaction ID.
                <br/><br/>
                &copy; ${new Date().getFullYear()} BR Max
              </p>
              <p style="margin: 0; font-size: 11px; line-height: 18px; color: #a1a1aa; text-align: center;">
                By purchasing our service you agree to our 
                <a href="https://www.brmax.xyz/terms" style="color: #71717a; text-decoration: underline;">Terms & Conditions</a> and 
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const emailText = `
PAYMENT SUCCESSFUL

Tokens Added: ${emailData.tokens}
Amount: ${formattedAmount}

--------------------------------
RECEIPT
--------------------------------
Method: ${formattedProvider}
Transaction ID: ${emailData.transactionId}
Date: ${emailData.timestamp}

If you have questions, please contact us on Discord.

By purchasing our service you agree to our Terms and conditions:
Terms: https://www.brmax.xyz/terms


© ${new Date().getFullYear()} BR Max
    `;

    const resend = new Resend(process.env.RESEND_API_KEY);
    console.log("Sending email to: ", emailData.to)
    await resend.emails.send({
      from: "BR Max <help@brmax.xyz>",
      to: emailData.to,
      subject: `Receipt for ${formattedAmount} - BR Max`,
      html: emailHtml,
      text: emailText,
    });

    return NextResponse.json({
      success: true,
      message: "Email sent successfully",
    });
  } catch (error) {
    console.error("Error sending email: ", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 },
    );
  }
}
