"use client"

import { useState, useEffect } from "react"
import { ShieldCheck, Check, Zap } from "lucide-react"
import { useUser } from "@clerk/nextjs"
import { TokenPackage } from "@/types/tokenPackages"

interface SubscriptionFormProps {
  className?: string
}

export default function SubscriptionForm({ className = "" }: SubscriptionFormProps) {
  const { user } = useUser()
  
  // --- STATE ---
  const [packages, setPackages] = useState<TokenPackage[]>([])
  const [selectedPackage, setSelectedPackage] = useState<TokenPackage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false)
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(true)

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
        
        if (data.hasActiveSubscription) {
          setHasActiveSubscription(true)
        }
      } catch (err) {
        console.error("Failed to check subscription:", err)
      } finally {
        setIsCheckingSubscription(false)
      }
    }

    checkSubscription()
  }, [user?.id])

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

  if (hasActiveSubscription) {
    return (
      <div className={`p-6 text-center bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl ${className}`}>
        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-lg font-bold text-blue-900 dark:text-blue-100 mb-2">
          You Have an Active Subscription
        </h2>
        <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
          Your tokens will be automatically renewed each month.
        </p>
        <a 
          href="/settings/billing" 
          className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Manage Subscription
        </a>
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
    <div className={`w-full ${className}`}>
      <div className="space-y-5">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full text-xs font-semibold mb-3">
            <Zap className="w-3.5 h-3.5" />
            Monthly Subscription
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
            Choose Your Plan
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Get tokens automatically credited every month
          </p>
        </div>

        {/* Package Selection */}
        <div>
          <label className="block text-xs font-semibold text-zinc-900 dark:text-white mb-3">
            Select Your Monthly Package
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {packages.map((pkg) => {
              const isSelected = selectedPackage?.id === pkg.id
              // @ts-expect-error This entire file will be removed soon
              const pricePerMonth = parseFloat(pkg.priceUSD)
              // @ts-expect-error This entire file will be removed soon
              const pricePerThousand = (pricePerMonth / parseInt(pkg.tokens)) * 1000

              return (
                <button
                  key={pkg.id}
                  onClick={() => setSelectedPackage(pkg)}
                  className={`relative group text-left p-4 rounded-xl border-2 transition-all duration-200 h-full flex flex-col ${
                    isSelected
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20 shadow-lg"
                      : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/50 hover:border-blue-300 dark:hover:border-blue-700"
                  }`}
                >
                  {pkg.popular && (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-blue-600 text-white text-[9px] font-bold tracking-wider rounded-full whitespace-nowrap">
                      MOST POPULAR
                    </div>
                  )}

                  {isSelected && (
                    <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                      <Check className="w-3 h-3 text-white stroke-[3]" />
                    </div>
                  )}

                  <div className="mb-4">
                    <h3
                      className={`text-lg font-bold mb-1.5 ${
                        isSelected ? "text-blue-700 dark:text-blue-300" : "text-zinc-900 dark:text-white"
                      }`}
                    >
                      {pkg.name}
                    </h3>
                    <div
                      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs ${
                        isSelected ? "bg-blue-100 dark:bg-blue-900/50" : "bg-zinc-100 dark:bg-zinc-900"
                      }`}
                    >
                      <Zap className={`w-3 h-3 ${isSelected ? "text-blue-600 dark:text-blue-400" : "text-zinc-500"}`} />
                      <span
                        className={`font-semibold ${
                          isSelected ? "text-blue-700 dark:text-blue-300" : "text-zinc-700 dark:text-zinc-300"
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
                          isSelected ? "text-blue-600 dark:text-blue-400" : "text-zinc-900 dark:text-white"
                        }`}
                      >
                        {pricePerMonth.toFixed(2)}
                      </span>
                      <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">/month</span>
                    </div>
                    <div
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded inline-block ${
                        isSelected
                          ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50"
                          : "text-zinc-500 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-900"
                      }`}
                    >
                      ${pricePerThousand.toFixed(2)} / 1K tokens
                    </div>
                  </div>

                  {pkg.features && pkg.features.length > 0 && (
                    <div className="space-y-2 mt-auto pt-3 border-t border-zinc-200 dark:border-zinc-800">
                      {pkg.features.map((feature, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs">
                          <div
                            className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center mt-0.5 ${
                              isSelected ? "bg-blue-100 dark:bg-blue-900/50" : "bg-zinc-100 dark:bg-zinc-900"
                            }`}
                          >
                            <Check
                              className={`w-2.5 h-2.5 stroke-[3] ${
                                isSelected ? "text-blue-600 dark:text-blue-400" : "text-green-600 dark:text-green-500"
                              }`}
                            />
                          </div>
                          <span
                            className={`leading-snug ${
                              isSelected ? "text-zinc-800 dark:text-zinc-200" : "text-zinc-600 dark:text-zinc-400"
                            }`}
                          >
                            {feature}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Summary */}
        {selectedPackage && (
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

        {/* Error Message */}
        {error && (
          <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Subscribe Button */}
        <button
          onClick={handleSubscribe}
          disabled={loading || !selectedPackage}
          className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-base font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-blue-500/30"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              Subscribe Now - Secure Payment
            </span>
          )}
        </button>

        {/* Info Note */}
        <div className="text-center text-xs text-zinc-500 dark:text-zinc-400">
          <p>✓ Cancel anytime • ✓ Secure payment by Stripe • ✓ Tokens auto-renewed monthly</p>
        </div>
      </div>
    </div>
  )
}