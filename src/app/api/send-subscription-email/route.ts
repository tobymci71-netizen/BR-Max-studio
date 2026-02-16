// /app/api/send-subscription-email/route.ts

import { NextResponse } from "next/server";
import { Resend } from "resend";

interface SubscriptionEmailData {
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

const isValidEmail = (email: string): boolean => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email) && email.length <= 254;
};

const sanitize = (str: string) =>
  str ? str.slice(0, 500).replace(/[<>]/g, "") : "";

export async function POST(request: Request) {
  try {
    const emailData: SubscriptionEmailData = await request.json();

    // Validation
    if (!isValidEmail(emailData.to)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    if (!emailData.type) {
      return NextResponse.json({ error: "Email type is required" }, { status: 400 });
    }

    // Sanitization
    const sanitizedData = {
      ...emailData,
      packageName: sanitize(emailData.packageName || ""),
      subscriptionId: sanitize(emailData.subscriptionId || ""),
      failureReason: sanitize(emailData.failureReason || ""),
    };

    // Generate email content based on type
    let subject: string;
    let emailHtml: string;
    let emailText: string;

    switch (sanitizedData.type) {
      case "subscription_started":
        ({ subject, emailHtml, emailText } = generateStartedEmail(sanitizedData));
        break;
      case "subscription_renewed":
        ({ subject, emailHtml, emailText } = generateRenewedEmail(sanitizedData));
        break;
      case "subscription_canceled":
        ({ subject, emailHtml, emailText } = generateCanceledEmail(sanitizedData));
        break;
      case "payment_failed":
        ({ subject, emailHtml, emailText } = generateFailedEmail(sanitizedData));
        break;
      default:
        return NextResponse.json(
          { error: "Invalid email type" },
          { status: 400 }
        );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    console.log(`Sending ${sanitizedData.type} email to:`, emailData.to);

    await resend.emails.send({
      from: "BR Max <noreply@brmax.xyz>",
      to: emailData.to,
      subject: subject,
      html: emailHtml,
      text: emailText,
    });

    return NextResponse.json({
      success: true,
      message: "Subscription email sent successfully",
    });
  } catch (error) {
    console.error("Error sending subscription email:", error);
    return NextResponse.json(
      { error: "Failed to send subscription email" },
      { status: 500 },
    );
  }
}

function generateStartedEmail(data: SubscriptionEmailData) {
  const subject = `Welcome to ${data.packageName} - Subscription Active!`;

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: 600; }
    .content { padding: 40px 30px; }
    .success-badge { background: #10b981; color: white; display: inline-block; padding: 12px 24px; border-radius: 25px; font-weight: 600; font-size: 16px; margin: 20px 0; }
    .token-display { background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .token-display h2 { margin: 0 0 8px 0; color: #1e40af; font-size: 22px; }
    .token-display p { margin: 0; color: #1e3a8a; font-size: 32px; font-weight: bold; }
    .info-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #6b7280; font-weight: 500; }
    .info-value { color: #111827; font-weight: 600; }
    .benefits { background: #ecfdf5; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .benefits h3 { color: #065f46; margin: 0 0 15px 0; font-size: 18px; }
    .benefits ul { margin: 0; padding-left: 20px; }
    .benefits li { color: #047857; margin: 8px 0; line-height: 1.6; }
    .cta-button { display: inline-block; background: #667eea; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .footer { background: #f9fafb; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; }
    .footer a { color: #667eea; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Subscription Activated!</h1>
    </div>
    
    <div class="content">
      <div style="text-align: center;">
        <div class="success-badge">✓ Payment Successful</div>
      </div>

      <p style="font-size: 16px; color: #374151; line-height: 1.6;">
        Welcome to <strong>${data.packageName}</strong>! Your monthly subscription is now active, and your tokens have been added to your account.
      </p>

      <div class="token-display">
        <h2>Monthly Tokens Added</h2>
        <p>+${data.tokens?.toLocaleString()} tokens</p>
      </div>

      <div class="info-box">
        <div class="info-row">
          <span class="info-label">Subscription Plan</span>
          <span class="info-value">${data.packageName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Billing Cycle</span>
          <span class="info-value">Monthly</span>
        </div>
        <div class="info-row">
          <span class="info-label">Subscription ID</span>
          <span class="info-value">${data.subscriptionId}</span>
        </div>
        ${data.nextBillingDate ? `
        <div class="info-row">
          <span class="info-label">Next Billing Date</span>
          <span class="info-value">${data.nextBillingDate}</span>
        </div>
        ` : ''}
      </div>

      <div class="benefits">
        <h3>✨ What's Included</h3>
        <ul>
          <li>Automatic monthly token renewal</li>
          <li>Uninterrupted access to all features</li>
          <li>Priority support via Discord</li>
          <li>Cancel anytime from your dashboard</li>
        </ul>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.NEXT_PUBLIC_BASE_URL}/dashboard" class="cta-button">
          Go to Dashboard →
        </a>
      </div>

      <p style="font-size: 14px; color: #6b7280; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
        <strong>Note:</strong> Your subscription will automatically renew each month. You'll receive ${data.tokens?.toLocaleString()} tokens with each billing cycle. You can manage or cancel your subscription anytime from your account settings.
      </p>
    </div>

    <div class="footer">
      <p style="margin: 0 0 10px 0;">
        Questions? <a href="https://discord.gg/h4chRAbjEZ">Contact us on Discord</a>
      </p>
      <p style="margin: 10px 0;">
        <a href="${process.env.NEXT_PUBLIC_BASE_URL}/terms">Terms & Conditions</a> • 
      </p>
      <p style="margin: 10px 0; color: #9ca3af;">
        © ${new Date().getFullYear()} BR Max. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
  `;

  const emailText = `
🎉 SUBSCRIPTION ACTIVATED!

Welcome to ${data.packageName}! Your monthly subscription is now active.

TOKENS ADDED: +${data.tokens?.toLocaleString()} tokens

SUBSCRIPTION DETAILS:
━━━━━━━━━━━━━━━━━━━━━━━
Plan: ${data.packageName}
Billing: Monthly
Subscription ID: ${data.subscriptionId}
${data.nextBillingDate ? `Next Billing: ${data.nextBillingDate}\n` : ''}

WHAT'S INCLUDED:
✓ Automatic monthly token renewal
✓ Uninterrupted access to all features  
✓ Priority support via Discord
✓ Cancel anytime from your dashboard

Manage your subscription: ${process.env.NEXT_PUBLIC_BASE_URL}/dashboard

Note: Your subscription will automatically renew each month with ${data.tokens?.toLocaleString()} tokens.

Questions? Contact us on Discord: https://discord.gg/h4chRAbjEZ

Terms: ${process.env.NEXT_PUBLIC_BASE_URL}/terms

© ${new Date().getFullYear()} BR Max
  `;

  return { subject, emailHtml, emailText };
}

function generateRenewedEmail(data: SubscriptionEmailData) {
  const subject = `Monthly Tokens Added - ${data.packageName} Renewed`;

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 20px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: 600; }
    .content { padding: 40px 30px; }
    .renewal-badge { background: #10b981; color: white; display: inline-block; padding: 12px 24px; border-radius: 25px; font-weight: 600; font-size: 16px; margin: 20px 0; }
    .token-display { background: #ecfdf5; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .token-display h2 { margin: 0 0 8px 0; color: #065f46; font-size: 22px; }
    .token-display p { margin: 0; color: #047857; font-size: 32px; font-weight: bold; }
    .info-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #6b7280; font-weight: 500; }
    .info-value { color: #111827; font-weight: 600; }
    .cta-button { display: inline-block; background: #10b981; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .footer { background: #f9fafb; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; }
    .footer a { color: #10b981; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔄 Subscription Renewed!</h1>
    </div>
    
    <div class="content">
      <div style="text-align: center;">
        <div class="renewal-badge">✓ Payment Processed</div>
      </div>

      <p style="font-size: 16px; color: #374151; line-height: 1.6;">
        Your <strong>${data.packageName}</strong> subscription has been renewed for another month. Your monthly tokens have been added to your account!
      </p>

      <div class="token-display">
        <h2>Monthly Tokens Added</h2>
        <p>+${data.tokens?.toLocaleString()} tokens</p>
      </div>

      <div class="info-box">
        <div class="info-row">
          <span class="info-label">Subscription Plan</span>
          <span class="info-value">${data.packageName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Subscription ID</span>
          <span class="info-value">${data.subscriptionId}</span>
        </div>
        ${data.nextBillingDate ? `
        <div class="info-row">
          <span class="info-label">Next Billing Date</span>
          <span class="info-value">${data.nextBillingDate}</span>
        </div>
        ` : ''}
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.NEXT_PUBLIC_BASE_URL}/dashboard" class="cta-button">
          View Dashboard →
        </a>
      </div>

      <p style="font-size: 14px; color: #6b7280; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
        Your subscription is active and will continue to renew automatically. You can manage or cancel your subscription anytime from your account settings.
      </p>
    </div>

    <div class="footer">
      <p style="margin: 0 0 10px 0;">
        Questions? <a href="https://discord.gg/h4chRAbjEZ">Contact us on Discord</a>
      </p>
      <p style="margin: 10px 0;">
        <a href="${process.env.NEXT_PUBLIC_BASE_URL}/terms">Terms & Conditions</a> • 
      </p>
      <p style="margin: 10px 0; color: #9ca3af;">
        © ${new Date().getFullYear()} BR Max. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
  `;

  const emailText = `
🔄 SUBSCRIPTION RENEWED!

Your ${data.packageName} subscription has been renewed for another month.

TOKENS ADDED: +${data.tokens?.toLocaleString()} tokens

SUBSCRIPTION DETAILS:
━━━━━━━━━━━━━━━━━━━━━━━
Plan: ${data.packageName}
Subscription ID: ${data.subscriptionId}
${data.nextBillingDate ? `Next Billing: ${data.nextBillingDate}\n` : ''}

Your subscription is active and will continue to renew automatically.

Manage your subscription: ${process.env.NEXT_PUBLIC_BASE_URL}/dashboard

Questions? Contact us on Discord: https://discord.gg/h4chRAbjEZ

© ${new Date().getFullYear()} BR Max
  `;

  return { subject, emailHtml, emailText };
}

function generateCanceledEmail(data: SubscriptionEmailData) {
  const subject = `Subscription Canceled - ${data.packageName}`;

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); padding: 40px 20px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: 600; }
    .content { padding: 40px 30px; }
    .cancel-badge { background: #6b7280; color: white; display: inline-block; padding: 12px 24px; border-radius: 25px; font-weight: 600; font-size: 16px; margin: 20px 0; }
    .info-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .info-box h3 { margin: 0 0 10px 0; color: #92400e; font-size: 18px; }
    .info-box p { margin: 0; color: #78350f; line-height: 1.6; }
    .details-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #6b7280; font-weight: 500; }
    .info-value { color: #111827; font-weight: 600; }
    .cta-button { display: inline-block; background: #667eea; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .footer { background: #f9fafb; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; }
    .footer a { color: #667eea; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Subscription Canceled</h1>
    </div>
    
    <div class="content">
      <div style="text-align: center;">
        <div class="cancel-badge">Subscription Ended</div>
      </div>

      <p style="font-size: 16px; color: #374151; line-height: 1.6;">
        Your <strong>${data.packageName}</strong> subscription has been canceled. We're sorry to see you go!
      </p>

      <div class="info-box">
        <h3>⚠️ Important Information</h3>
        <p>
          Your subscription has been canceled and will not renew. Any remaining tokens in your account will stay available for use.
        </p>
      </div>

      <div class="details-box">
        <div class="info-row">
          <span class="info-label">Subscription Plan</span>
          <span class="info-value">${data.packageName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Subscription ID</span>
          <span class="info-value">${data.subscriptionId}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Status</span>
          <span class="info-value">Canceled</span>
        </div>
      </div>

      <div style="background: #f0f9ff; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="color: #1e40af; margin: 0 0 10px 0;">We'd Love Your Feedback</h3>
        <p style="color: #1e3a8a; margin: 0; line-height: 1.6;">
          Help us improve! Let us know why you canceled and what we could do better. Join our Discord community to share your thoughts.
        </p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.NEXT_PUBLIC_BASE_URL}/pricing" class="cta-button">
          View Plans →
        </a>
      </div>

      <p style="font-size: 14px; color: #6b7280; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
        Changed your mind? You can resubscribe anytime!
      </p>
    </div>

    <div class="footer">
      <p style="margin: 0 0 10px 0;">
        Questions? <a href="https://discord.gg/h4chRAbjEZ">Contact us on Discord</a>
      </p>
      <p style="margin: 10px 0; color: #9ca3af;">
        © ${new Date().getFullYear()} BR Max. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
  `;

  const emailText = `
SUBSCRIPTION CANCELED

Your ${data.packageName} subscription has been canceled.

SUBSCRIPTION DETAILS:
━━━━━━━━━━━━━━━━━━━━━━━
Plan: ${data.packageName}
Subscription ID: ${data.subscriptionId}
Status: Canceled

⚠️ IMPORTANT: Your subscription will not renew. Any remaining tokens in your account will stay available for use.

We'd love your feedback! Let us know why you canceled and what we could do better.
Contact us on Discord: https://discord.gg/h4chRAbjEZ

Changed your mind? You can resubscribe anytime!
View Plans: ${process.env.NEXT_PUBLIC_BASE_URL}/pricing

© ${new Date().getFullYear()} BR Max
  `;

  return { subject, emailHtml, emailText };
}

function generateFailedEmail(data: SubscriptionEmailData) {
  const subject = `Payment Failed - Action Required for ${data.packageName}`;

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 40px 20px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: 600; }
    .content { padding: 40px 30px; }
    .alert-badge { background: #ef4444; color: white; display: inline-block; padding: 12px 24px; border-radius: 25px; font-weight: 600; font-size: 16px; margin: 20px 0; }
    .alert-box { background: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .alert-box h3 { margin: 0 0 10px 0; color: #991b1b; font-size: 18px; }
    .alert-box p { margin: 0; color: #7f1d1d; line-height: 1.6; }
    .info-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #6b7280; font-weight: 500; }
    .info-value { color: #111827; font-weight: 600; }
    .steps-box { background: #f0f9ff; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .steps-box h3 { color: #1e40af; margin: 0 0 15px 0; }
    .steps-box ol { margin: 0; padding-left: 20px; }
    .steps-box li { color: #1e3a8a; margin: 10px 0; line-height: 1.6; }
    .cta-button { display: inline-block; background: #ef4444; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .footer { background: #f9fafb; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; }
    .footer a { color: #ef4444; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ Payment Failed</h1>
    </div>
    
    <div class="content">
      <div style="text-align: center;">
        <div class="alert-badge">Action Required</div>
      </div>

      <p style="font-size: 16px; color: #374151; line-height: 1.6;">
        We were unable to process the payment for your <strong>${data.packageName}</strong> subscription.
      </p>

      <div class="alert-box">
        <h3>🚨 Immediate Action Needed</h3>
        <p>
          Your subscription will be canceled if we cannot process your payment. Please update your payment method to maintain uninterrupted access.
        </p>
      </div>

      <div class="info-box">
        <div class="info-row">
          <span class="info-label">Subscription Plan</span>
          <span class="info-value">${data.packageName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Subscription ID</span>
          <span class="info-value">${data.subscriptionId}</span>
        </div>
        ${data.failureReason ? `
        <div class="info-row">
          <span class="info-label">Failure Reason</span>
          <span class="info-value">${data.failureReason}</span>
        </div>
        ` : ''}
      </div>

      <div class="steps-box">
        <h3>How to Fix This</h3>
        <ol>
          <li>Go to your <strong>Account Settings</strong></li>
          <li>Navigate to <strong>Billing & Subscriptions</strong></li>
          <li>Update your payment method</li>
          <li>Click <strong>Retry Payment</strong></li>
        </ol>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/billing" class="cta-button">
          Update Payment Method →
        </a>
      </div>

      <p style="font-size: 14px; color: #6b7280; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
        <strong>Common Reasons for Payment Failure:</strong><br>
        • Insufficient funds<br>
        • Expired card<br>
        • Card blocked by your bank<br>
        • Incorrect billing information
      </p>
    </div>

    <div class="footer">
      <p style="margin: 0 0 10px 0;">
        Need help? <a href="https://discord.gg/h4chRAbjEZ">Contact us on Discord</a>
      </p>
      <p style="margin: 10px 0; color: #9ca3af;">
        © ${new Date().getFullYear()} BR Max. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
  `;

  const emailText = `
⚠️ PAYMENT FAILED - ACTION REQUIRED

We were unable to process the payment for your ${data.packageName} subscription.

🚨 IMMEDIATE ACTION NEEDED:
Your subscription will be canceled if we cannot process your payment. 
Please update your payment method to maintain uninterrupted access.

SUBSCRIPTION DETAILS:
━━━━━━━━━━━━━━━━━━━━━━━
Plan: ${data.packageName}
Subscription ID: ${data.subscriptionId}
${data.failureReason ? `Failure Reason: ${data.failureReason}\n` : ''}

HOW TO FIX THIS:
1. Go to your Account Settings
2. Navigate to Billing & Subscriptions
3. Update your payment method
4. Click Retry Payment

Update payment method: ${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/billing

COMMON REASONS FOR PAYMENT FAILURE:
• Insufficient funds
• Expired card
• Card blocked by your bank
• Incorrect billing information

Need help? Contact us on Discord: https://discord.gg/h4chRAbjEZ

© ${new Date().getFullYear()} BR Max
  `;

  return { subject, emailHtml, emailText };
}