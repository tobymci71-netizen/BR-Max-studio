"use client"

import { useState, useEffect } from "react"
import { ShieldCheck, Check, Zap, Crown, ArrowUpRight, ArrowDownRight, Loader2, X } from "lucide-react"
import { useUser } from "@clerk/nextjs"
import { TokenPackage } from "@/types/tokenPackages"

interface SubscriptionFormProps {
  className?: string
}

interface ActiveSubscription {
  packageId: string
  packageName: string
  status: string
  priceUSD?: number
  tokens?: number
}

export default function SubscriptionForm({ className = "" }: SubscriptionFormProps) {
  const { user } = useUser()

  // --- STATE ---
  const [packages, setPackages] = useState<TokenPackage[]>([])
  const [selectedPackage, setSelectedPackage] = useState<TokenPackage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [activeSubscription, setActiveSubscription] = useState<ActiveSubscription | null>(null)
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(true)
  const [showChangePlanModal, setShowChangePlanModal] = useState(false)
  const [changePlanTarget, setChangePlanTarget] = useState<TokenPackage | null>(null)
  const [changePlanLoading, setChangePlanLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState("")

  // --- FETCH PACKAGES ---
  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const response = await fetch("/api/token-packages")
        const data = await response.json()

        if (data.packages && data.packages.length > 0) {
          setPackages(data.packages)
          // Auto-select the popular package or first one
          const popularPackage = data.packages.find((pkg: TokenPackage) => pkg.popular)
          setSelectedPackage(popularPackage || data.packages[0])
        }
      } catch (err) {
        console.error("Failed to fetch packages:", err)
        setError("Failed to load packages")
      }
    }

    fetchPackages()
  }, [])

  // --- CHECK FOR ACTIVE SUBSCRIPTION ---
  useEffect(() => {
    const checkSubscription = async () => {
      if (!user?.id) {
        setIsCheckingSubscription(false)
        return
      }

      try {
        const response = await fetch("/api/stripe/check-subscription")
        const data = await response.json()

        if (data.hasActiveSubscription && data.subscription) {
          setActiveSubscription({
            packageId: data.subscription.id,
            packageName: data.subscription.packageName,
            status: data.subscription.status,
            priceUSD: data.subscription.price,
            tokens: data.subscription.tokens,
          })
        }
      } catch (err) {
        console.error("Failed to check subscription:", err)
      } finally {
        setIsCheckingSubscription(false)
      }
    }

    checkSubscription()
  }, [user?.id])

  // --- HANDLE CHANGE PLAN ---
  const [modalError, setModalError] = useState("")

  const handleOpenChangePlanModal = (pkg: TokenPackage) => {
    setChangePlanTarget(pkg)
    setShowChangePlanModal(true)
    setError("")
    setModalError("")
  }

  const handleCloseChangePlanModal = () => {
    setShowChangePlanModal(false)
    setChangePlanTarget(null)
    setModalError("")
  }

  const handleChangePlan = async () => {
    if (!changePlanTarget) {
      setModalError("No plan selected")
      return
    }

    if (!changePlanTarget.stripe_price_id) {
      console.error("Missing stripe_price_id for package:", changePlanTarget)
      setModalError("This plan is not configured for changes. Please contact support.")
      return
    }

    try {
      setChangePlanLoading(true)
      setModalError("")
      setError("")

      console.log("Changing plan to:", changePlanTarget.name, "with price ID:", changePlanTarget.stripe_price_id)

      const response = await fetch("/api/stripe/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPriceId: changePlanTarget.stripe_price_id }),
      })

      const data = await response.json()
      console.log("Change plan response:", data)

      if (response.ok) {
        setSuccessMessage(
          data.type === "upgrade"
            ? `Successfully upgraded to ${changePlanTarget.name}! You'll be charged the prorated difference.`
            : `Successfully changed to ${changePlanTarget.name}! Changes will take effect at your next billing cycle.`
        )
        setShowChangePlanModal(false)
        setChangePlanTarget(null)
        // Refresh subscription status
        const subResponse = await fetch("/api/stripe/check-subscription")
        const subData = await subResponse.json()
        if (subData.hasActiveSubscription && subData.subscription) {
          setActiveSubscription({
            packageId: subData.subscription.packageId || subData.subscription.id,
            packageName: subData.subscription.packageName,
            status: subData.subscription.status,
            priceUSD: subData.subscription.price,
            tokens: subData.subscription.tokens,
          })
        }
      } else {
        console.error("Change plan failed:", data.error)
        setModalError(data.error || "Failed to change plan")
      }
    } catch (err) {
      console.error("Error changing plan:", err)
      setModalError("Failed to change plan. Please try again.")
    } finally {
      setChangePlanLoading(false)
    }
  }

  const isUpgrade = (pkg: TokenPackage) => {
    if (!activeSubscription?.priceUSD) return true
    return parseFloat(String(pkg.priceUSD)) > activeSubscription.priceUSD
  }

  // --- HANDLE STRIPE CHECKOUT ---
  const handleSubscribe = async () => {
    if (!selectedPackage || loading) return
    
    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId: selectedPackage.id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout session")
      }

      if (data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url
      } else {
        throw new Error("Invalid server response")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed")
      setLoading(false)
    }
  }

  // --- RENDERS ---
  if (isCheckingSubscription) {
    return (
      <div className={`flex flex-col items-center justify-center p-12 bg-white/5 rounded-xl ${className}`}>
        <div className="w-5 h-5 border-2 border-zinc-500 border-t-white rounded-full animate-spin mb-3" />
        <p className="text-xs text-zinc-500">Loading...</p>
      </div>
    )
  }

  if (packages.length === 0) {
    return (
      <div className={`p-6 text-center bg-zinc-50 dark:bg-zinc-900 rounded-xl ${className}`}>
        <p className="text-sm text-zinc-500">No packages available</p>
      </div>
    )
  }

  return (
    <div className={`w-full max-w-6xl mx-auto ${className}`}>
      <div className="space-y-5">
        {/* Active Subscription Banner */}
        {activeSubscription && (
          <div className="p-5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center flex-shrink-0">
                  <Crown className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="font-bold text-green-900 dark:text-green-100 mb-1">
                    Active Subscription
                  </h3>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    You're currently subscribed to <strong>{activeSubscription.packageName}</strong>
                  </p>
                </div>
              </div>
              <a
                href="/subscription"
                className="px-4 py-2 bg-green-600 dark:bg-green-700 hover:bg-green-700 dark:hover:bg-green-600 text-white text-sm font-semibold rounded-lg transition whitespace-nowrap"
              >
                Manage Subscription
              </a>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full text-xs font-semibold mb-3">
            <Zap className="w-3.5 h-3.5" />
            Monthly Subscription
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
            {activeSubscription ? "Available Plans" : "Choose Your Plan"}
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {activeSubscription ? "Browse all available subscription plans" : "Get tokens automatically credited every month"}
          </p>
        </div>

        {/* Package Selection */}
        <div>
          <label className="block text-xs font-semibold text-zinc-900 dark:text-white mb-3">
            {activeSubscription ? "Select a Plan to Switch To" : "Select Your Monthly Package"}
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {packages.map((pkg) => {
              const isSelected = selectedPackage?.id === pkg.id
              const isCurrentPlan = activeSubscription?.packageId === pkg.id
              const isPlanUpgrade = activeSubscription ? isUpgrade(pkg) : false
              // @ts-expect-error This entire file will be removed soon
              const pricePerMonth = parseFloat(pkg.priceUSD)
              // @ts-expect-error This entire file will be removed soon
              const pricePerThousand = (pricePerMonth / parseInt(pkg.tokens)) * 1000

              return (
                <div
                  key={pkg.id}
                  className={`relative group text-left p-4 rounded-xl border-2 transition-all duration-200 h-full flex flex-col ${
                    isCurrentPlan
                      ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                      : isSelected && !activeSubscription
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20 shadow-lg"
                      : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/50 hover:border-blue-300 dark:hover:border-blue-700"
                  }`}
                >
                  {isCurrentPlan && (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-green-600 text-white text-[9px] font-bold tracking-wider rounded-full whitespace-nowrap flex items-center gap-1">
                      <Crown className="w-2.5 h-2.5" />
                      YOUR PLAN
                    </div>
                  )}
                  {!isCurrentPlan && pkg.popular && (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-blue-600 text-white text-[9px] font-bold tracking-wider rounded-full whitespace-nowrap">
                      MOST POPULAR
                    </div>
                  )}

                  {isSelected && !isCurrentPlan && !activeSubscription && (
                    <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                      <Check className="w-3 h-3 text-white stroke-[3]" />
                    </div>
                  )}

                  {/* Clickable area for non-subscribers */}
                  {!activeSubscription && (
                    <button
                      onClick={() => setSelectedPackage(pkg)}
                      className="absolute inset-0 w-full h-full cursor-pointer"
                      aria-label={`Select ${pkg.name}`}
                    />
                  )}

                  <div className="mb-4">
                    <h3
                      className={`text-lg font-bold mb-1.5 ${
                        isCurrentPlan
                          ? "text-green-700 dark:text-green-300"
                          : isSelected && !activeSubscription
                          ? "text-blue-700 dark:text-blue-300"
                          : "text-zinc-900 dark:text-white"
                      }`}
                    >
                      {pkg.name}
                    </h3>
                    <div
                      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs ${
                        isCurrentPlan
                          ? "bg-green-100 dark:bg-green-900/50"
                          : isSelected && !activeSubscription
                          ? "bg-blue-100 dark:bg-blue-900/50"
                          : "bg-zinc-100 dark:bg-zinc-900"
                      }`}
                    >
                      <Zap
                        className={`w-3 h-3 ${
                          isCurrentPlan
                            ? "text-green-600 dark:text-green-400"
                            : isSelected && !activeSubscription
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-zinc-500"
                        }`}
                      />
                      <span
                        className={`font-semibold ${
                          isCurrentPlan
                            ? "text-green-700 dark:text-green-300"
                            : isSelected && !activeSubscription
                            ? "text-blue-700 dark:text-blue-300"
                            : "text-zinc-700 dark:text-zinc-300"
                        }`}
                      >
                        {/* @ts-expect-error This entire file will be removed soon */}
                        {parseInt(pkg.tokens).toLocaleString()} tokens/mo
                      </span>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-baseline gap-1.5 mb-1">
                      <span className="text-lg text-zinc-500 dark:text-zinc-400">$</span>
                      <span
                        className={`text-3xl font-bold ${
                          isCurrentPlan
                            ? "text-green-600 dark:text-green-400"
                            : isSelected && !activeSubscription
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-zinc-900 dark:text-white"
                        }`}
                      >
                        {pricePerMonth.toFixed(2)}
                      </span>
                      <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">/month</span>
                    </div>
                    <div
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded inline-block ${
                        isCurrentPlan
                          ? "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/50"
                          : isSelected && !activeSubscription
                          ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50"
                          : "text-zinc-500 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-900"
                      }`}
                    >
                      ${pricePerThousand.toFixed(2)} / 1K tokens
                    </div>
                  </div>

                  {pkg.features && pkg.features.length > 0 && (
                    <div className="space-y-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                      {pkg.features.map((feature, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs">
                          <div
                            className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center mt-0.5 ${
                              isCurrentPlan
                                ? "bg-green-100 dark:bg-green-900/50"
                                : isSelected && !activeSubscription
                                ? "bg-blue-100 dark:bg-blue-900/50"
                                : "bg-zinc-100 dark:bg-zinc-900"
                            }`}
                          >
                            <Check
                              className={`w-2.5 h-2.5 stroke-[3] ${
                                isCurrentPlan
                                  ? "text-green-600 dark:text-green-400"
                                  : isSelected && !activeSubscription
                                  ? "text-blue-600 dark:text-blue-400"
                                  : "text-green-600 dark:text-green-500"
                              }`}
                            />
                          </div>
                          <span
                            className={`leading-snug ${
                              isCurrentPlan || (isSelected && !activeSubscription) ? "text-zinc-800 dark:text-zinc-200" : "text-zinc-600 dark:text-zinc-400"
                            }`}
                          >
                            {feature}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Change Plan Button for subscribers */}
                  {activeSubscription && !isCurrentPlan && (
                    <button
                      onClick={() => handleOpenChangePlanModal(pkg)}
                      className={`mt-auto pt-3 w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                        isPlanUpgrade
                          ? "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25"
                          : "bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      {isPlanUpgrade ? (
                        <>
                          <ArrowUpRight className="w-4 h-4" />
                          Upgrade to this plan
                        </>
                      ) : (
                        <>
                          <ArrowDownRight className="w-4 h-4" />
                          Switch to this plan
                        </>
                      )}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Summary - Only show for non-subscribers */}
        {selectedPackage && !activeSubscription && (
          <div className="py-4 px-5 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-xl border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-blue-900 dark:text-blue-100">Monthly Total</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-blue-700 dark:text-blue-300">{selectedPackage.name}</span>
                  <span className="text-[10px] text-blue-400">•</span>
                  <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                    {/* @ts-expect-error This entire file will be removed soon */}
                    {parseInt(selectedPackage.tokens).toLocaleString()} tokens/mo
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {/* @ts-expect-error This entire file will be removed soon */}
                  ${parseFloat(selectedPackage.priceUSD).toFixed(2)}
                </div>
                <div className="text-[10px] text-blue-600 dark:text-blue-400">per month</div>
              </div>
            </div>
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 flex items-start gap-3">
            <Check className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <p className="text-green-700 dark:text-green-300 text-sm">{successMessage}</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Subscribe Button - Only for non-subscribers */}
        {!activeSubscription && (
          <button
            onClick={handleSubscribe}
            disabled={loading || !selectedPackage}
            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-base font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-indigo-500/25"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <ShieldCheck className="w-5 h-5" />
                Subscribe Now - Secure Payment
              </span>
            )}
          </button>
        )}

        {/* Info Note */}
        <div className="text-center text-xs text-zinc-500 dark:text-zinc-400">
          <p>✓ Cancel anytime • ✓ Secure payment by Stripe • ✓ Tokens auto-renewed monthly</p>
        </div>
      </div>

      {/* Change Plan Confirmation Modal */}
      {showChangePlanModal && changePlanTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 max-w-md w-full shadow-2xl">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isUpgrade(changePlanTarget) ? (
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/25">
                      <ArrowUpRight className="w-5 h-5 text-white" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center">
                      <ArrowDownRight className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                    </div>
                  )}
                  <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                    {isUpgrade(changePlanTarget) ? "Upgrade Plan" : "Change Plan"}
                  </h3>
                </div>
                <button
                  onClick={handleCloseChangePlanModal}
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition"
                >
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                  You're about to {isUpgrade(changePlanTarget) ? "upgrade" : "switch"} from{" "}
                  <strong className="text-zinc-900 dark:text-white">{activeSubscription?.packageName}</strong> to{" "}
                  <strong className="text-zinc-900 dark:text-white">{changePlanTarget.name}</strong>.
                </p>

                <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">New plan</span>
                    <span className="font-semibold text-zinc-900 dark:text-white">{changePlanTarget.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">New price</span>
                    <span className="font-semibold text-zinc-900 dark:text-white">
                      ${parseFloat(String(changePlanTarget.priceUSD)).toFixed(2)}/mo
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">Tokens</span>
                    <span className="font-semibold text-zinc-900 dark:text-white">
                      {Number(changePlanTarget.tokens).toLocaleString()}/mo
                    </span>
                  </div>
                </div>
              </div>

              {isUpgrade(changePlanTarget) ? (
                <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 rounded-xl mb-4">
                  <p className="text-sm text-indigo-800 dark:text-indigo-300">
                    <strong>Upgrade:</strong> You'll be charged the prorated difference immediately. Your new plan takes effect right away.
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl mb-4">
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    <strong>Downgrade:</strong> Your new plan will take effect at the start of your next billing cycle. You'll keep your current benefits until then.
                  </p>
                </div>
              )}

              {/* Modal Error */}
              {modalError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                  <p className="text-sm text-red-600 dark:text-red-400">{modalError}</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 rounded-b-2xl">
              <div className="flex gap-3">
                <button
                  onClick={handleCloseChangePlanModal}
                  className="flex-1 px-4 py-3 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-xl font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleChangePlan}
                  disabled={changePlanLoading}
                  className={`flex-1 px-4 py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                    isUpgrade(changePlanTarget)
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25"
                      : "bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-900"
                  }`}
                >
                  {changePlanLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : isUpgrade(changePlanTarget) ? (
                    "Confirm Upgrade"
                  ) : (
                    "Confirm Change"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}