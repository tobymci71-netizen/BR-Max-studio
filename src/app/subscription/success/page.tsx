"use client"

import type React from "react"

import { useEffect, useState, Suspense, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Loader2, CheckCircle2, ArrowRight, AlertCircle } from "lucide-react"

type StatusType = "loading" | "success" | "webhook_failed" | "error"

interface SubscriptionData {
  packageName: string
  tokens: number
  transactionId?: string
  price: number
  nextBillingDate?: string
  status?: string
}

function Confetti() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(-10px) translateX(0) rotateZ(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) translateX(var(--tx)) rotateZ(720deg);
            opacity: 0;
          }
        }
        .confetti {
          animation: confetti-fall linear forwards;
          position: absolute;
          width: 10px;
          height: 10px;
        }
      `}</style>
      {Array.from({ length: 50 }).map((_, i) => (
        <div
          key={i}
          className="confetti"
          style={
            {
              left: `${Math.random() * 100}%`,
              top: "-10px",
              backgroundColor: ["#007aff", "#00b4ff", "#00ff88", "#ffd700", "#ff6b6b"][Math.floor(Math.random() * 5)],
              "--tx": `${(Math.random() - 0.5) * 200}px`,
              animation: `confetti-fall ${2 + Math.random() * 1}s linear ${Math.random() * 0.5}s forwards`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}

function SubscriptionSuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<StatusType>("loading")
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>("")
  const [retryCount, setRetryCount] = useState(0)
  const hasVerified = useRef(false)

  const verifySession = async () => {
    const sessionId = searchParams.get("session_id")

    if (!sessionId) {
      setStatus("error")
      setErrorMessage("No session ID found. Please contact support if you were charged.")
      return
    }

    try {
      console.log("🔍 Verifying session...")
      const response = await fetch(`/api/stripe/verify-session?session_id=${sessionId}`)
      const data = await response.json()

      console.log("📋 Verification response:", data)

      if (data.success && data.status === "active") {
        console.log("✅ Subscription verified successfully!")
        setSubscriptionData(data.subscription)
        setStatus("success")
      } else if (data.status === "webhook_failed") {
        console.error("❌ Webhook failed to create subscription")
        setSubscriptionData(data.subscription)
        setStatus("webhook_failed")
        setErrorMessage(data.message || "Webhook processing failed")
      } else {
        console.error("❌ Verification failed:", data.error)
        setStatus("error")
        setErrorMessage(data.message || data.error || "Failed to verify subscription")
      }
    } catch (error) {
      console.error("❌ Error verifying session:", error)
      setStatus("error")
      setErrorMessage("Failed to verify your subscription. Please contact support.")
    }
  }

  useEffect(() => {
    if (!hasVerified.current) {
      hasVerified.current = true
      verifySession()
    }
  }, [])

  const handleManualRetry = () => {
    if (retryCount >= 2) {
      setStatus("error")
      setErrorMessage("Maximum retry attempts reached. Please contact support.")
      return
    }
    setRetryCount((prev) => prev + 1)
    setStatus("loading")
    verifySession()
  }

  // LOADING STATE
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div
            className="absolute bottom-20 right-20 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl animate-pulse"
            style={{ animationDelay: "1s" }}
          ></div>
        </div>

        <div className="relative text-center z-10">
          <Loader2 className="w-12 h-12 animate-spin text-white/60 mx-auto mb-6" />
          <h2 className="text-xl font-medium text-white">Verifying subscription</h2>
          <p className="text-white/50 mt-2 text-sm">This will only take a moment</p>
          {retryCount > 0 && <p className="text-xs text-white/40 mt-3">Retry {retryCount}/3</p>}
        </div>
      </div>
    )
  }

  // WEBHOOK FAILED STATE
  if (status === "webhook_failed") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-6 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-10 right-10 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl"></div>
        </div>
        <div className="max-w-md w-full relative z-10">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-amber-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-amber-500" />
              </div>
              <h1 className="text-xl font-semibold text-white">Payment Received</h1>
            </div>

            <p className="text-white/60 text-sm mb-6">
              Your payment was successful, but we encountered an issue activating your subscription. Our team has been
              notified.
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
    )
  }

  // ERROR STATE
  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-6 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-10 left-10 w-96 h-96 bg-red-500/5 rounded-full blur-3xl"></div>
        </div>
        <div className="max-w-md w-full relative z-10">
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
    )
  }

  // SUCCESS STATE
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black p-6 overflow-hidden relative">
      <Confetti />

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          50% { transform: translateY(-20px) translateX(10px); }
        }
        @keyframes float-reverse {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          50% { transform: translateY(20px) translateX(-10px); }
        }
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .animate-float-reverse {
          animation: float-reverse 8s ease-in-out infinite;
        }
        .animate-glow-pulse {
          animation: glow-pulse 2s ease-in-out infinite;
        }
        .animate-slide-up {
          animation: slide-up 0.6s ease-out forwards;
        }
        .animate-scale-in {
          animation: scale-in 0.5s ease-out forwards;
        }
      `}</style>

      {/* Background animated orbs */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-20 w-80 h-80 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full blur-3xl opacity-20 animate-float"></div>
        <div className="absolute top-40 right-10 w-96 h-96 bg-gradient-to-br from-cyan-500 to-blue-400 rounded-full blur-3xl opacity-15 animate-float-reverse"></div>
        <div
          className="absolute -bottom-10 left-1/3 w-72 h-72 bg-gradient-to-br from-blue-600 to-cyan-400 rounded-full blur-3xl opacity-10 animate-float"
          style={{ animationDelay: "2s" }}
        ></div>
      </div>

      <div className="w-full max-w-4xl relative z-10">
        <div
          className="bg-gradient-to-br from-blue-500/10 via-transparent to-cyan-500/10 backdrop-blur-xl border border-blue-400/30 rounded-3xl overflow-hidden shadow-2xl animate-slide-up px-8 py-12 md:px-16 md:py-16"
          style={{ animationDelay: "0.2s" }}
        >
          {/* Success content - horizontal layout */}
          <div className="flex flex-col md:flex-row items-center gap-12">
            {/* Left side - Success icon and title */}
            <div
              className="flex flex-col items-center md:items-start flex-1 animate-slide-up"
              style={{ animationDelay: "0.4s" }}
            >
              <div className="relative w-16 h-16 flex-shrink-0 mb-6">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-cyan-600 rounded-full blur animate-glow-pulse"></div>
                <div
                  className="relative w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-full flex items-center justify-center animate-scale-in"
                  style={{ animationDelay: "0.6s" }}
                >
                  <CheckCircle2 className="w-8 h-8 text-white" />
                </div>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-white text-center md:text-left">
                Subscription Active
              </h1>
              <p className="text-cyan-300 text-lg mt-2">{subscriptionData?.packageName}</p>
            </div>

            {/* Right side - Stats and button */}
            <div
              className="flex flex-col items-center md:items-end gap-6 flex-1 animate-slide-up"
              style={{ animationDelay: "0.5s" }}
            >
              <div className="text-center md:text-right">
                <div className="text-white/60 text-sm mb-3">Tokens Added</div>
                <div className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-300 bg-clip-text text-transparent">
                  {subscriptionData?.tokens?.toLocaleString()}
                </div>
              </div>
              <button
                onClick={() => router.push("/dashboard")}
                className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white px-8 py-4 rounded-xl font-semibold transition-all flex items-center gap-2 text-base shadow-lg hover:shadow-cyan-500/30 animate-slide-up"
                style={{ animationDelay: "0.6s" }}
              >
                Start Creating Videos Now
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Details section below */}
          <div className="mt-12 pt-8 border-t border-blue-400/20 animate-slide-up" style={{ animationDelay: "0.7s" }}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <DetailRow
                label="Status"
                value={
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-300 text-xs font-medium rounded-full border border-blue-500/30">
                    ● Active
                  </span>
                }
              />
              <DetailRow label="Billing" value="Monthly" />
              <DetailRow label="Price" value={`$${subscriptionData?.price}/mo`} />
              {subscriptionData?.nextBillingDate && (
                <DetailRow
                  label="Next Billing"
                  value={new Date(subscriptionData.nextBillingDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                />
              )}
            </div>
          </div>

          {/* Secondary action */}
          <div className="mt-8 text-center animate-slide-up" style={{ animationDelay: "0.8s" }}>
            <button
              onClick={() => router.push("/subscription")}
              className="text-blue-300 hover:text-blue-200 text-sm font-medium transition"
            >
              Manage Subscription
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper component for detail rows
function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="text-center">
      <div className="text-white/40 text-xs mb-2">{label}</div>
      <div className="text-white text-sm font-semibold">{value}</div>
    </div>
  )
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
  )
}
