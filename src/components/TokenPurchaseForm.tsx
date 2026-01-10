"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import Script from "next/script"
import { ShieldCheck, Check } from "lucide-react"
import { useUser } from "@clerk/nextjs"
import { TokenPackage } from "@/types/tokenPackages"

// --- Types & Interfaces ---
interface RazorpayResponse {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

interface RazorpayError {
  error: {
    description: string
    code?: string
    source?: string
    step?: string
    reason?: string
    metadata?: Record<string, unknown>
  }
}

declare global {
  interface Window {
    Razorpay: new (
      options: Record<string, unknown>,
    ) => {
      open: () => void
      on: (event: string, callback: (response: RazorpayError) => void) => void
    }
  }
}

// --- Utils & Constants ---
const TIMEOUT_MS = 5000

const PAYPAL_CURRENCIES = new Set([
  "USD",
  "AUD",
  "DKK",
  "CHF",
  "CZK",
  "CAD",
  "EUR",
  "GBP",
  "HKD",
  "HUF",
  "ILS",
  "JPY",
  "MXN",
  "NOK",
  "NZD",
  "PHP",
  "PLN",
  "RUB",
  "SEK",
  "SGD",
  "THB",
  "TWD",
])

interface TokenPurchaseFormProps {
  className?: string
}

export default function TokenPurchaseForm({ className = "" }: TokenPurchaseFormProps) {
  const { user } = useUser()
  const userEmail = user?.primaryEmailAddress?.emailAddress || ""
  const userContact = user?.primaryPhoneNumber?.phoneNumber || ""

  // --- STATE ---
  const [isInitializing, setIsInitializing] = useState(true)
  const [viewMode, setViewMode] = useState<"PAYPAL" | "RAZORPAY" | "UNSUPPORTED">("UNSUPPORTED")
  const [currency, setCurrency] = useState("USD")
  const [exchangeRate, setExchangeRate] = useState(1)
  const [selectedPackage, setSelectedPackage] = useState<TokenPackage | null>(null)
  const [packages, setPackages] = useState<TokenPackage[]>([])
  const [loading, setLoading] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState("")
  const [isRazorpayLoaded, setIsRazorpayLoaded] = useState(false)

  // --- FETCH PACKAGES ---
  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const response = await fetch("/api/token-packages")
        const data = await response.json()

        if (data.packages && data.packages.length > 0) {
          setPackages(data.packages)
          // Auto-select first package or the popular one
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

  // --- INITIALIZATION ---
  useEffect(() => {
    let mounted = true
    const initialize = async () => {
      try {
        const locRes = (await Promise.race([
          fetch("https://ipapi.co/json/"),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), TIMEOUT_MS)),
        ])) as Response

        if (!mounted) return

        const locData = await locRes.json()
        const country = locData.country_code || "US"
        const localCurrency = locData.currency || "USD"

        let mode: typeof viewMode = "UNSUPPORTED"
        let targetCurrency = localCurrency

        if (country === "IN") {
          mode = "RAZORPAY"
          targetCurrency = "INR"
        } else if (PAYPAL_CURRENCIES.has(localCurrency)) {
          mode = "PAYPAL"
        } else {
          mode = "UNSUPPORTED"
        }

        setViewMode(mode)
        setCurrency(targetCurrency)

        if (mode !== "UNSUPPORTED" && targetCurrency !== "USD") {
          try {
            const rateRes = await fetch("/api/get-exchange-rate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ target: targetCurrency }),
            })
            const rateData = await rateRes.json()
            if (mounted && rateData.rate) setExchangeRate(rateData.rate)
          } catch {
            console.warn("Rate fetch failed, defaulting to 1:1")
          }
        }
      } catch {
        if (mounted) {
          setViewMode("PAYPAL")
          setCurrency("USD")
        }
      } finally {
        if (mounted) setIsInitializing(false)
      }
    }

    initialize()
    return () => {
      mounted = false
    }
  }, [])

  // --- CALCULATIONS ---
  const currencyFormatter = useMemo(() => {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    } catch {
      return { format: (n: number) => `${currency} ${n.toFixed(2)}` }
    }
  }, [currency])

  const { tokens, price, displayPrice } = useMemo(() => {
    if (!selectedPackage) {
      return { tokens: 0, price: "0.00", displayPrice: currencyFormatter.format(0) }
    }

    const rawPrice = selectedPackage.priceUSD * exchangeRate
    return {
      tokens: selectedPackage.tokens,
      price: rawPrice.toFixed(2),
      displayPrice: currencyFormatter.format(rawPrice),
    }
  }, [selectedPackage, exchangeRate, currencyFormatter])

  // --- HANDLERS ---
  const handlePaypalPayment = useCallback(async () => {
    if (!selectedPackage || loading) return
    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/paypal/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokens,
          amount: price,
          currency,
          packageId: selectedPackage.id,
          packageName: selectedPackage.name,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to create order")
      if (data.approvalUrl) window.location.href = data.approvalUrl
      else throw new Error("Invalid server response")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed")
      setLoading(false)
    }
  }, [selectedPackage, tokens, price, currency, loading])

  const handleRazorpayPayment = useCallback(async () => {
    if (!selectedPackage || loading || isVerifying) return
    if (!isRazorpayLoaded || !window.Razorpay) {
      setError("Payment system loading... please try again in a moment.")
      return
    }

    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokens,
          amount: price,
          currency: "INR",
          packageId: selectedPackage.id,
          packageName: selectedPackage.name,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      const options = {
        key: data.key,
        amount: data.amount,
        currency: data.currency,
        name: "BR-Max",
        description: `${selectedPackage.name} Package - ${tokens} Tokens`,
        order_id: data.orderId,
        prefill: { name: user?.fullName || "", email: userEmail, contact: userContact },
        theme: { color: "#108fea" },
        handler: async (response: RazorpayResponse) => {
          setIsVerifying(true)
          setLoading(false)
          try {
            const verifyRes = await fetch("/api/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response),
            })
            const verifyData = await verifyRes.json()
            if (verifyData.success) {
              window.location.href = `/payment-success?txnId=${verifyData.transactionId}`
            } else setError("Verification failed")
          } catch {
            setError("Verification error")
            setLoading(false)
            setIsVerifying(false)
          }
        },
      }

      const rzp1 = new window.Razorpay(options)
      rzp1.on("payment.failed", (r: RazorpayError) => {
        setError(r.error.description)
        setLoading(false)
      })
      rzp1.open()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed")
      setLoading(false)
    }
  }, [selectedPackage, tokens, price, loading, isRazorpayLoaded, isVerifying, user, userEmail, userContact])

  // --- RENDERS ---

  if (isVerifying) {
    return (
      <div
        className={`flex flex-col items-center justify-center p-8 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl ${className}`}
      >
        <div className="relative w-16 h-16 mb-4">
          <div className="absolute inset-0 border-4 border-zinc-200 dark:border-zinc-800 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <ShieldCheck className="absolute inset-0 m-auto w-6 h-6 text-zinc-900 dark:text-white" />
        </div>
        <p className="text-sm font-medium text-zinc-900 dark:text-white">Verifying Payment...</p>
      </div>
    )
  }

  if (isInitializing) {
    return (
      <div className={`flex flex-col items-center justify-center p-12 bg-white/5 rounded-xl ${className}`}>
        <div className="w-5 h-5 border-2 border-zinc-500 border-t-white rounded-full animate-spin mb-3" />
        <p className="text-xs text-zinc-500">Loading packages...</p>
      </div>
    )
  }

  if (viewMode === "UNSUPPORTED") {
    return (
      <div className={`p-6 text-center bg-zinc-50 dark:bg-zinc-900 rounded-xl ${className}`}>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">Currency Not Supported</h2>
        <p className="text-sm text-zinc-500 mb-4">
          We do not currently support payments in <strong>{currency}</strong>.
        </p>
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
      {viewMode === "RAZORPAY" && (
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          onLoad={() => {
            console.log("Razorpay script loaded successfully")
            setIsRazorpayLoaded(true)
          }}
          onError={() => {
            console.error("Failed to load Razorpay script")
            setIsRazorpayLoaded(false)
          }}
        />
      )}

      <div className="space-y-5">
        <div>
          <label className="block text-xs font-semibold text-zinc-900 dark:text-white mb-3">
            Select Your Token Package
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {packages.map((pkg) => {
              const isSelected = selectedPackage?.id === pkg.id
              const packagePrice = pkg.priceUSD * exchangeRate
              const displayPkgPrice = currencyFormatter.format(packagePrice)
              const pricePerThousand = currencyFormatter.format((packagePrice / pkg.tokens) * 1000)

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
                      POPULAR
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
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle
                          cx="12"
                          cy="12"
                          r="9"
                          className={isSelected ? "stroke-blue-600 dark:stroke-blue-400" : "stroke-zinc-500"}
                          strokeWidth="2"
                        />
                        <path
                          d="M12 8V12L14.5 14.5"
                          className={isSelected ? "stroke-blue-600 dark:stroke-blue-400" : "stroke-zinc-500"}
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                      <span
                        className={`font-semibold ${
                          isSelected ? "text-blue-700 dark:text-blue-300" : "text-zinc-700 dark:text-zinc-300"
                        }`}
                      >
                        {pkg.tokens.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-baseline gap-1.5 mb-1">
                      <span
                        className={`text-2xl font-bold ${
                          isSelected ? "text-blue-600 dark:text-blue-400" : "text-zinc-900 dark:text-white"
                        }`}
                      >
                        {displayPkgPrice.split(/[^\d.,]/)[0] || displayPkgPrice.replace(/[^\d.,]/g, "")}
                      </span>
                      <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">{currency}</span>
                    </div>
                    <div
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded inline-block ${
                        isSelected
                          ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50"
                          : "text-zinc-500 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-900"
                      }`}
                    >
                      {pricePerThousand} / 1K
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

        {selectedPackage && (
          <div className="py-4 px-5 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-zinc-900 dark:text-white">Total</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{selectedPackage.name}</span>
                  <span className="text-[10px] text-zinc-400">•</span>
                  <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400">
                    {selectedPackage.tokens.toLocaleString()} tokens
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-zinc-900 dark:text-white">{displayPrice}</div>
              </div>
            </div>
          </div>
        )}

        {/* Errors */}
        {error && (
          <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {viewMode === "PAYPAL" && (
          <button
            onClick={handlePaypalPayment}
            disabled={loading || !selectedPackage}
            className="w-full py-4 bg-[#0070BA] hover:bg-[#003087] text-white text-base font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.067 8.478c.492.88.556 2.014.3 3.327-.74 3.806-3.276 5.12-6.514 5.12h-.5a.805.805 0 00-.794.68l-.04.22-.63 3.993-.028.15a.805.805 0 01-.794.68H7.72a.483.483 0 01-.477-.558l.638-4.04.08-.51.02-.127a.805.805 0 01.794-.68h1.794c3.238 0 5.774-1.314 6.514-5.12.256-1.313.192-2.446-.3-3.327z" />
                </svg>
                Continue with PayPal
              </span>
            )}
          </button>
        )}

        {viewMode === "RAZORPAY" && (
          <button
            onClick={handleRazorpayPayment}
            disabled={loading || !selectedPackage || !isRazorpayLoaded}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white text-base font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </span>
            ) : (
              "Pay with Razorpay"
            )}
          </button>
        )}
      </div>
    </div>
  )
}
