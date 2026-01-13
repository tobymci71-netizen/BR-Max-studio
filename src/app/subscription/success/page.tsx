// /app/subscription-success/page.tsx
"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, CheckCircle2, ArrowRight, AlertCircle } from "lucide-react";

type StatusType = "loading" | "success" | "webhook_failed" | "error";

interface SubscriptionData {
  packageName: string;
  tokens: number;
  transactionId?: string;
  price: number;
  nextBillingDate?: string;
  status?: string;
}

function SubscriptionSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<StatusType>("loading");
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [retryCount, setRetryCount] = useState(0);
  const hasVerified = useRef(false);

  const verifySession = async () => {
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      setStatus("error");
      setErrorMessage("No session ID found. Please contact support if you were charged.");
      return;
    }

    try {
      console.log("🔍 Verifying session...");
      const response = await fetch(`/api/stripe/verify-session?session_id=${sessionId}`);
      const data = await response.json();

      console.log("📋 Verification response:", data);

      if (data.success && data.status === "active") {
        // SUCCESS - subscription fully verified
        console.log("✅ Subscription verified successfully!");
        setSubscriptionData(data.subscription);
        setStatus("success");
      } else if (data.status === "webhook_failed") {
        // WEBHOOK FAILED - don't keep retrying
        console.error("❌ Webhook failed to create subscription");
        setSubscriptionData(data.subscription);
        setStatus("webhook_failed");
        setErrorMessage(data.message || "Webhook processing failed");
      } else {
        // ERROR - something went wrong
        console.error("❌ Verification failed:", data.error);
        setStatus("error");
        setErrorMessage(data.message || data.error || "Failed to verify subscription");
      }
    } catch (error) {
      console.error("❌ Error verifying session:", error);
      setStatus("error");
      setErrorMessage("Failed to verify your subscription. Please contact support.");
    }
  };

  useEffect(() => {
    if (!hasVerified.current) {
      hasVerified.current = true;
      verifySession();
    }
  }, []);

  const handleManualRetry = () => {
    if (retryCount >= 2) {
      setStatus("error");
      setErrorMessage("Maximum retry attempts reached. Please contact support.");
      return;
    }
    setRetryCount(prev => prev + 1);
    setStatus("loading");
    verifySession();
  };

  // LOADING STATE
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="text-center">
          <Loader2 className="w-16 h-16 animate-spin text-purple-600 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-800">Verifying your subscription...</h2>
          <p className="text-gray-600 mt-2">Please wait while we confirm your payment</p>
          {retryCount > 0 && (
            <p className="text-sm text-gray-500 mt-2">Retry attempt {retryCount}/3</p>
          )}
        </div>
      </div>
    );
  }

  // WEBHOOK FAILED STATE
  if (status === "webhook_failed") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-orange-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Setup Issue</h1>
          <p className="text-gray-600 mb-4">
            {errorMessage}
          </p>
          <div className="bg-blue-50 rounded-lg p-4 mb-4 text-left">
            <h3 className="font-semibold text-blue-900 mb-2">Your Payment Status:</h3>
            <p className="text-sm text-blue-800 mb-2">✓ Payment received successfully</p>
            <p className="text-sm text-red-800">✗ Subscription setup failed</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 text-left">
            <h3 className="font-semibold text-yellow-800 mb-2">Next Steps:</h3>
            <ol className="text-sm text-yellow-700 space-y-1">
              <li>1. Contact support on Discord immediately</li>
              <li>2. Provide this Session ID: <br/><code className="text-xs bg-yellow-100 px-1 rounded">{searchParams.get("session_id")}</code></li>
              <li>3. We'll manually activate your subscription</li>
            </ol>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => window.open("https://discord.gg/brmax", "_blank")}
              className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition"
            >
              Contact Support Now
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className="w-full border-2 border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:border-gray-400 hover:bg-gray-50 transition"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ERROR STATE
  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Verification Failed</h1>
          <p className="text-gray-600 mb-6">
            {errorMessage}
          </p>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 text-left">
            <h3 className="font-semibold text-yellow-800 mb-2">What to do:</h3>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>1. Check your email for a receipt</li>
              <li>2. Wait a few minutes and check your dashboard</li>
              <li>3. If charged but no subscription, contact support</li>
            </ul>
          </div>
          <div className="space-y-3">
            {retryCount < 2 && (
              <button
                onClick={handleManualRetry}
                className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition"
              >
                Try Again ({2 - retryCount} attempts left)
              </button>
            )}
            <button
              onClick={() => router.push("/dashboard")}
              className="w-full border-2 border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:border-gray-400 hover:bg-gray-50 transition"
            >
              Go to Dashboard
            </button>
            <button
              onClick={() => window.open("https://discord.gg/brmax", "_blank")}
              className="w-full border-2 border-purple-300 text-purple-700 py-3 rounded-lg font-semibold hover:border-purple-400 hover:bg-purple-50 transition"
            >
              Contact Support
            </button>
          </div>
        </div>
      </div>
    );
  }

  // SUCCESS STATE
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Success Header */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-8 text-center">
          <CheckCircle2 className="w-20 h-20 text-white mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white mb-2">
            🎉 Subscription Activated!
          </h1>
          <p className="text-green-100">
            Welcome to {subscriptionData?.packageName || "your subscription"}
          </p>
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Token Display */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-6 mb-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Tokens Added ✓</p>
                <p className="text-4xl font-bold text-purple-600">
                  +{subscriptionData?.tokens?.toLocaleString() || "0"}
                </p>
                {subscriptionData?.transactionId && (
                  <p className="text-xs text-gray-500 mt-1">
                    ID: {subscriptionData.transactionId}
                  </p>
                )}
              </div>
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Subscription Details */}
          <div className="space-y-4 mb-6">
            <h2 className="text-xl font-semibold text-gray-800">Subscription Details</h2>
            
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Plan</span>
                <span className="font-semibold text-gray-900">
                  {subscriptionData?.packageName || "Premium Plan"}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Status</span>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                  ✓ Active
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Billing Cycle</span>
                <span className="font-semibold text-gray-900">Monthly</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Price</span>
                <span className="font-semibold text-gray-900">
                  ${subscriptionData?.price || "0"}/month
                </span>
              </div>
              
              {subscriptionData?.nextBillingDate && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Next Billing</span>
                  <span className="font-semibold text-gray-900">
                    {new Date(subscriptionData.nextBillingDate).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric"
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* What's Next */}
          <div className="bg-blue-50 rounded-lg p-6 mb-6">
            <h3 className="font-semibold text-gray-800 mb-3">✨ What's Next?</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start">
                <span className="text-green-500 mr-2 font-bold">✓</span>
                <span>Your tokens have been added to your account</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2 font-bold">✓</span>
                <span>A confirmation email has been sent to your inbox</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2 font-bold">✓</span>
                <span>Your subscription will auto-renew monthly</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2 font-bold">✓</span>
                <span>You can cancel anytime from your dashboard</span>
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-4 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition flex items-center justify-center gap-2"
            >
              Go to Dashboard
              <ArrowRight className="w-5 h-5" />
            </button>
            
            <button
              onClick={() => router.push("/dashboard/subscription")}
              className="w-full border-2 border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:border-gray-400 hover:bg-gray-50 transition"
            >
              Manage Subscription
            </button>
          </div>

          {/* Support */}
          <p className="text-center text-sm text-gray-500 mt-6">
            Need help? <a href="https://discord.gg/brmax" className="text-purple-600 hover:underline">Contact us on Discord</a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SubscriptionSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
          <div className="text-center">
            <Loader2 className="w-16 h-16 animate-spin text-purple-600 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-800">Loading...</h2>
          </div>
        </div>
      }
    >
      <SubscriptionSuccessContent />
    </Suspense>
  );
}