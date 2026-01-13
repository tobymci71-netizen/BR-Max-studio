"use client";

import { useEffect, useState, Suspense, useRef } from "react";
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
        console.log("✅ Subscription verified successfully!");
        setSubscriptionData(data.subscription);
        setStatus("success");
      } else if (data.status === "webhook_failed") {
        console.error("❌ Webhook failed to create subscription");
        setSubscriptionData(data.subscription);
        setStatus("webhook_failed");
        setErrorMessage(data.message || "Webhook processing failed");
      } else {
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
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-white/60 mx-auto mb-6" />
          <h2 className="text-xl font-medium text-white">Verifying subscription</h2>
          <p className="text-white/50 mt-2 text-sm">This will only take a moment</p>
          {retryCount > 0 && (
            <p className="text-xs text-white/40 mt-3">Retry {retryCount}/3</p>
          )}
        </div>
      </div>
    );
  }

  // WEBHOOK FAILED STATE
  if (status === "webhook_failed") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-6">
        <div className="max-w-md w-full">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-amber-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-amber-500" />
              </div>
              <h1 className="text-xl font-semibold text-white">Payment Received</h1>
            </div>

            <p className="text-white/60 text-sm mb-6">
              Your payment was successful, but we encountered an issue activating your subscription. Our team has been notified.
            </p>

            <div className="space-y-3 mb-6">
              <div className="bg-zinc-800/50 border border-zinc-700 rounded p-3 text-sm">
                <div className="text-white/40 mb-1">Session ID</div>
                <code className="text-white/80 text-xs font-mono">{searchParams.get("session_id")}</code>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => window.open("https://discord.gg/brmax", "_blank")}
                className="w-full bg-white text-black py-3 rounded-lg font-medium hover:bg-white/90 transition text-sm"
              >
                Contact Support
              </button>
              <button
                onClick={() => router.push("/dashboard")}
                className="w-full bg-zinc-800 border border-zinc-700 text-white py-3 rounded-lg font-medium hover:bg-zinc-700 transition text-sm"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ERROR STATE
  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-6">
        <div className="max-w-md w-full">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
              <h1 className="text-xl font-semibold text-white">Verification Failed</h1>
            </div>

            <p className="text-white/60 text-sm mb-6">{errorMessage}</p>

            <div className="bg-zinc-800/50 border border-zinc-700 rounded p-4 mb-6">
              <div className="text-sm text-white/60 space-y-2">
                <p>• Check your email for a receipt</p>
                <p>• Wait a few minutes and check your dashboard</p>
                <p>• Contact support if you were charged</p>
              </div>
            </div>

            <div className="space-y-2">
              {retryCount < 2 && (
                <button
                  onClick={handleManualRetry}
                  className="w-full bg-white text-black py-3 rounded-lg font-medium hover:bg-white/90 transition text-sm"
                >
                  Try Again ({2 - retryCount} left)
                </button>
              )}
              <button
                onClick={() => router.push("/dashboard")}
                className="w-full bg-zinc-800 border border-zinc-700 text-white py-3 rounded-lg font-medium hover:bg-zinc-700 transition text-sm"
              >
                Go to Dashboard
              </button>
              <button
                onClick={() => window.open("https://discord.gg/brmax", "_blank")}
                className="w-full border border-zinc-700 text-white/80 py-3 rounded-lg font-medium hover:bg-zinc-800 transition text-sm"
              >
                Contact Support
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // SUCCESS STATE
  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-6">
      <div className="max-w-lg w-full">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          {/* Success Header */}
          <div className="p-8 border-b border-zinc-800">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-white">Subscription Active</h1>
                <p className="text-white/50 text-sm mt-1">{subscriptionData?.packageName}</p>
              </div>
            </div>
          </div>

          {/* Token Display */}
          <div className="p-8 border-b border-zinc-800">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white/50 text-sm mb-2">Tokens Added</div>
                <div className="text-4xl font-bold text-white">
                  {subscriptionData?.tokens?.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="p-8 space-y-3">
            <DetailRow
              label="Status"
              value={<span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 text-green-500 text-xs font-medium rounded">Active</span>}
            />
            <DetailRow
              label="Billing"
              value="Monthly"
            />
            <DetailRow
              label="Price"
              value={`$${subscriptionData?.price}/mo`}
            />
            {subscriptionData?.nextBillingDate && (
              <DetailRow
                label="Next Billing"
                value={new Date(subscriptionData.nextBillingDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric"
                })}
              />
            )}
            {subscriptionData?.transactionId && (
              <DetailRow
                label="Transaction"
                value={<code className="text-xs text-white/60">{subscriptionData.transactionId}</code>}
              />
            )}
          </div>

          {/* Actions */}
          <div className="p-6 bg-black/40 border-t border-zinc-800 space-y-2">
            <button
              onClick={() => router.push("/dashboard")}
              className="w-full bg-white text-black py-3 rounded-lg font-medium hover:bg-white/90 transition flex items-center justify-center gap-2 text-sm"
            >
              Go to Dashboard
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => router.push("/subscription")}
              className="w-full border border-zinc-700 text-white/80 py-3 rounded-lg font-medium hover:bg-zinc-800 transition text-sm"
            >
              Manage Subscription
            </button>
          </div>

          {/* Support Link */}
          <div className="px-6 pb-6 text-center">
            <a
              href="https://discord.gg/brmax"
              className="text-xs text-white/40 hover:text-white/60 transition"
            >
              Need help? Contact Support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper component for detail rows
function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-white/50 text-sm">{label}</span>
      <span className="text-white text-sm font-medium">{value}</span>
    </div>
  );
}

export default function SubscriptionSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-black">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-white/60 mx-auto mb-6" />
            <h2 className="text-xl font-medium text-white">Loading</h2>
          </div>
        </div>
      }
    >
      <SubscriptionSuccessContent />
    </Suspense>
  );
}
