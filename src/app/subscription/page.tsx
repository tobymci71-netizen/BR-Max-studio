"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import {
  CreditCard,
  Calendar,
  DollarSign,
  Package,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ArrowLeft,
  Coins,
  Crown,
  Sparkles,
  X,
} from "lucide-react"

interface PaymentMethod {
  brand: string
  last4: string
  expMonth: number
  expYear: number
}

interface Subscription {
  id: string
  packageId: string
  packageName: string
  tokens: number
  price: number
  status: string
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  canceledAt: string | null
  stripeSubscriptionId: string
  stripeCustomerId: string
  paymentMethod: PaymentMethod | null
}

const CANCEL_REASONS = [
  { id: "too_expensive", label: "Too expensive" },
  { id: "not_using", label: "Not using it enough" },
  { id: "missing_features", label: "Missing features I need" },
  { id: "found_alternative", label: "Found a better alternative" },
  { id: "temporary_pause", label: "Just need a temporary break" },
  { id: "technical_issues", label: "Technical issues" },
  { id: "other", label: "Other reason" },
]

export default function SubscriptionPage() {
  const router = useRouter()
  const { user, isLoaded: userLoaded } = useUser()
  const [loading, setLoading] = useState(true)
  const [hasSubscription, setHasSubscription] = useState(false)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [selectedReason, setSelectedReason] = useState("")
  const [customReason, setCustomReason] = useState("")

  const fetchSubscription = async () => {
    if (!user) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError("")

      const response = await fetch("/api/stripe/subscription/get")
      const data = await response.json()

      if (response.ok) {
        console.log("Subscription data received:", data)
        setHasSubscription(data.hasSubscription)
        setSubscription(data.subscription)
      } else {
        if (response.status === 401) {
          setError("Please sign in to view your subscription")
        } else {
          setError(data.error || "Failed to fetch subscription")
        }
      }
    } catch (err) {
      console.error("Error fetching subscription:", err)
      setError("Failed to load subscription data. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (userLoaded) {
      if (user) {
        fetchSubscription()
      } else {
        setLoading(false)
        setError("Please sign in to view your subscription")
      }
    }
  }, [user, userLoaded])

  const handleOpenCancelModal = () => {
    setShowCancelModal(true)
    setSelectedReason("")
    setCustomReason("")
  }

  const handleCloseCancelModal = () => {
    setShowCancelModal(false)
    setSelectedReason("")
    setCustomReason("")
  }

  const handleCancelSubscription = async () => {
    const reason = selectedReason === "other" ? customReason : selectedReason
    if (!reason) {
      setError("Please select or enter a reason for cancellation")
      return
    }

    try {
      setActionLoading(true)
      setError("")
      setSuccessMessage("")

      const response = await fetch("/api/stripe/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccessMessage("Subscription will be cancelled at the end of your billing period")
        setShowCancelModal(false)
        await fetchSubscription()
      } else {
        setError(data.error || "Failed to cancel subscription")
      }
    } catch (err) {
      console.error("Error cancelling subscription:", err)
      setError("Failed to cancel subscription")
    } finally {
      setActionLoading(false)
    }
  }

  const handleReactivateSubscription = async () => {
    try {
      setActionLoading(true)
      setError("")
      setSuccessMessage("")

      const response = await fetch("/api/stripe/subscription/reactivate", {
        method: "POST",
      })

      const data = await response.json()

      if (response.ok) {
        setSuccessMessage("Subscription has been reactivated!")
        await fetchSubscription()
      } else {
        setError(data.error || "Failed to reactivate subscription")
      }
    } catch (err) {
      console.error("Error reactivating subscription:", err)
      setError("Failed to reactivate subscription")
    } finally {
      setActionLoading(false)
    }
  }

  if (!userLoaded || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-indigo-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/25">
            <Loader2 className="w-8 h-8 animate-spin text-white" />
          </div>
          <p className="text-zinc-600 dark:text-zinc-400 font-medium">Loading subscription details...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-indigo-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 text-center shadow-xl shadow-indigo-500/5">
          <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-red-500/25">
            <AlertCircle className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Authentication Required</h1>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">Please sign in to view your subscription details.</p>
          <button
            onClick={() => router.push("/sign-in")}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white py-3 rounded-xl font-semibold transition shadow-lg shadow-indigo-500/25"
          >
            Sign In
          </button>
        </div>
      </div>
    )
  }

  if (!hasSubscription || !subscription) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-indigo-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 text-center shadow-xl shadow-indigo-500/5">
          <div className="w-16 h-16 bg-gradient-to-br from-zinc-400 to-zinc-600 dark:from-zinc-600 dark:to-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Package className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">No Active Subscription</h1>
          <p className="text-zinc-600 dark:text-zinc-400 mb-2">
            Hi <strong className="text-zinc-900 dark:text-white">{user.firstName || user.username || "there"}</strong>!
          </p>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            You don't have an active subscription. Subscribe to unlock premium features and get monthly tokens.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => router.push("/pricing")}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white py-3 rounded-xl font-semibold transition shadow-lg shadow-indigo-500/25"
            >
              View Pricing Plans
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className="w-full border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 py-3 rounded-xl font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })
  }

  const getStatusBadge = () => {
    if (subscription.cancelAtPeriodEnd) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
          <XCircle className="w-3 h-3 mr-1" />
          Cancelling Soon
        </span>
      )
    }
    if (subscription.status === "active") {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Active
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
        {subscription.status}
      </span>
    )
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-indigo-950 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => router.push("/dashboard")}
              className="flex items-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white mb-4 transition group"
            >
              <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
              Back to Studio
            </button>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/25">
                <Crown className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Subscription</h1>
            </div>
            <p className="text-zinc-600 dark:text-zinc-400">Manage your subscription and billing</p>
          </div>

          {/* Account Info Banner */}
          <div className="mb-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-500/25">
                {user.firstName?.charAt(0) ||
                  user.username?.charAt(0) ||
                  user.emailAddresses[0]?.emailAddress.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-zinc-900 dark:text-white">
                  {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.username || "User"}
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{user.emailAddresses[0]?.emailAddress || "No email"}</p>
              </div>
              <button
                onClick={() => fetchSubscription()}
                disabled={loading}
                className="p-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl transition"
                title="Refresh subscription data"
              >
                <RefreshCw className={`w-4 h-4 text-zinc-600 dark:text-zinc-400 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Messages */}
          {error && (
            <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-3 flex-shrink-0 mt-0.5" />
              <p className="text-red-800 dark:text-red-300">{error}</p>
            </div>
          )}

          {successMessage && (
            <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 flex items-start">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mr-3 flex-shrink-0 mt-0.5" />
              <p className="text-green-800 dark:text-green-300">{successMessage}</p>
            </div>
          )}

          {/* Subscription Status Card */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden mb-6 shadow-xl shadow-indigo-500/5">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                    <Sparkles className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-1">{subscription.packageName}</h2>
                    <p className="text-indigo-200">Your Current Plan</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusBadge()}
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="grid md:grid-cols-2 gap-4">
                {/* Tokens */}
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4">
                  <div className="flex items-center mb-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center mr-3 shadow-lg shadow-amber-500/25">
                      <Coins className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="font-semibold text-zinc-900 dark:text-white">Monthly Tokens</h3>
                  </div>
                  <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                    {subscription.tokens.toLocaleString()}
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Tokens per month</p>
                </div>

                {/* Price */}
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-4">
                  <div className="flex items-center mb-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center mr-3 shadow-lg shadow-emerald-500/25">
                      <DollarSign className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="font-semibold text-zinc-900 dark:text-white">Monthly Price</h3>
                  </div>
                  <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">${subscription.price}/mo</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Billed monthly</p>
                </div>

                {/* Next Billing Date */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800/50 rounded-xl p-4">
                  <div className="flex items-center mb-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center mr-3 shadow-lg shadow-blue-500/25">
                      <Calendar className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="font-semibold text-zinc-900 dark:text-white">
                      {subscription.cancelAtPeriodEnd ? "Access Until" : "Next Billing"}
                    </h3>
                  </div>
                  <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{formatDate(subscription.currentPeriodEnd)}</p>
                  {subscription.cancelAtPeriodEnd && (
                    <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">Subscription ends on this date</p>
                  )}
                </div>

                {/* Payment Method */}
                <div className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border border-violet-200 dark:border-violet-800/50 rounded-xl p-4">
                  <div className="flex items-center mb-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center mr-3 shadow-lg shadow-violet-500/25">
                      <CreditCard className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="font-semibold text-zinc-900 dark:text-white">Payment Method</h3>
                  </div>
                  {subscription.paymentMethod ? (
                    <>
                      <p className="text-xl font-bold text-violet-600 dark:text-violet-400 capitalize">
                        {subscription.paymentMethod.brand} •••• {subscription.paymentMethod.last4}
                      </p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        Expires {subscription.paymentMethod.expMonth}/{subscription.paymentMethod.expYear}
                      </p>
                    </>
                  ) : (
                    <p className="text-zinc-500 dark:text-zinc-400">No payment method on file</p>
                  )}
                </div>
              </div>

              {/* Billing Period */}
              <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                <h3 className="font-semibold text-zinc-900 dark:text-white mb-3">Current Billing Period</h3>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500 dark:text-zinc-400">Started:</span>
                  <span className="font-medium text-zinc-900 dark:text-white">{formatDate(subscription.currentPeriodStart)}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-zinc-500 dark:text-zinc-400">Ends:</span>
                  <span className="font-medium text-zinc-900 dark:text-white">{formatDate(subscription.currentPeriodEnd)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">Manage Subscription</h3>

            {subscription.cancelAtPeriodEnd ? (
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 border border-orange-200 dark:border-orange-800/50 rounded-xl p-5">
                  <p className="text-orange-800 dark:text-orange-300 mb-4">
                    Your subscription is set to cancel on <strong>{formatDate(subscription.currentPeriodEnd)}</strong>.
                    You can reactivate it to continue your subscription.
                  </p>
                  <button
                    onClick={handleReactivateSubscription}
                    disabled={actionLoading}
                    className="flex items-center justify-center w-full md:w-auto px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-semibold transition shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-5 h-5 mr-2" />
                        Reactivate Subscription
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border border-indigo-200 dark:border-indigo-800/50 rounded-xl p-5">
                  <h4 className="font-semibold text-zinc-900 dark:text-white mb-2">Want to change your plan?</h4>
                  <p className="text-zinc-600 dark:text-zinc-400 mb-4">You can upgrade or downgrade your subscription anytime.</p>
                  <button
                    onClick={() => router.push("/pricing")}
                    className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-semibold transition shadow-lg shadow-indigo-500/25"
                  >
                    View Plans
                  </button>
                </div>

                {/* Cancel as tiny text link */}
                <div className="text-center pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  <button
                    onClick={handleOpenCancelModal}
                    disabled={actionLoading}
                    className="text-xs text-zinc-400 hover:text-red-500 dark:hover:text-red-400 underline underline-offset-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel subscription
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cancel Subscription Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 max-w-md w-full shadow-2xl">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Cancel Subscription</h3>
                <button
                  onClick={handleCloseCancelModal}
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition"
                >
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
                We're sorry to see you go. Please let us know why you're cancelling.
              </p>
            </div>

            <div className="p-6 space-y-3">
              {CANCEL_REASONS.map((reason) => (
                <label
                  key={reason.id}
                  className={`flex items-center p-3 rounded-xl border cursor-pointer transition ${
                    selectedReason === reason.id
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30"
                      : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="cancelReason"
                    value={reason.id}
                    checked={selectedReason === reason.id}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    className="w-4 h-4 text-indigo-600 border-zinc-300 dark:border-zinc-600 focus:ring-indigo-500"
                  />
                  <span className="ml-3 text-sm font-medium text-zinc-900 dark:text-white">{reason.label}</span>
                </label>
              ))}

              {selectedReason === "other" && (
                <textarea
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Please tell us more..."
                  rows={3}
                  className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                />
              )}
            </div>

            <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 rounded-b-2xl">
              <div className="flex gap-3">
                <button
                  onClick={handleCloseCancelModal}
                  className="flex-1 px-4 py-3 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-xl font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-700 transition"
                >
                  Keep Subscription
                </button>
                <button
                  onClick={handleCancelSubscription}
                  disabled={actionLoading || (!selectedReason || (selectedReason === "other" && !customReason.trim()))}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Cancelling...
                    </>
                  ) : (
                    "Confirm Cancellation"
                  )}
                </button>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center mt-3">
                You'll retain access until {formatDate(subscription.currentPeriodEnd)}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
