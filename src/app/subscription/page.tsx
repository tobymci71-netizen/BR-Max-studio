"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import {
  CreditCard,
  Calendar,
  Package,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ArrowLeft,
  Zap,
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
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-400 mx-auto mb-4" />
          <p className="text-zinc-500 dark:text-zinc-400">Loading subscription details...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center">
          <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Authentication Required</h1>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">Please sign in to view your subscription details.</p>
          <button
            onClick={() => router.push("/sign-in")}
            className="w-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 py-3 rounded-lg font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition"
          >
            Sign In
          </button>
        </div>
      </div>
    )
  }

  if (!hasSubscription || !subscription) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center">
          <div className="w-14 h-14 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-7 h-7 text-zinc-500 dark:text-zinc-400" />
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
              className="w-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 py-3 rounded-lg font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition"
            >
              View Pricing Plans
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className="w-full border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 py-3 rounded-lg font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
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
          Cancelling
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
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">
        {subscription.status}
      </span>
    )
  }

  return (
    <>
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-8 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => router.push("/dashboard")}
              className="flex items-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white mb-4 transition"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Studio
            </button>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Subscription</h1>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">Manage your subscription and billing</p>
              </div>
              <button
                onClick={() => fetchSubscription()}
                disabled={loading}
                className="p-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 text-zinc-600 dark:text-zinc-400 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Messages */}
          {error && (
            <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-3 flex-shrink-0 mt-0.5" />
              <p className="text-red-800 dark:text-red-300 text-sm">{error}</p>
            </div>
          )}

          {successMessage && (
            <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mr-3 flex-shrink-0 mt-0.5" />
              <p className="text-green-800 dark:text-green-300 text-sm">{successMessage}</p>
            </div>
          )}

          {/* Current Plan Card */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden mb-6">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-white">{subscription.packageName}</h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">Current Plan</p>
                  </div>
                </div>
                {getStatusBadge()}
              </div>
            </div>

            <div className="p-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Monthly Tokens</p>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                    {subscription.tokens.toLocaleString()}
                  </p>
                </div>
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Monthly Price</p>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-white">${subscription.price}/mo</p>
                </div>
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {subscription.cancelAtPeriodEnd ? "Access Until" : "Next Billing"}
                    </p>
                  </div>
                  <p className="text-lg font-semibold text-zinc-900 dark:text-white">
                    {formatDate(subscription.currentPeriodEnd)}
                  </p>
                </div>
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard className="w-3.5 h-3.5 text-zinc-400" />
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Payment Method</p>
                  </div>
                  {subscription.paymentMethod ? (
                    <p className="text-lg font-semibold text-zinc-900 dark:text-white capitalize">
                      {subscription.paymentMethod.brand} •••• {subscription.paymentMethod.last4}
                    </p>
                  ) : (
                    <p className="text-sm text-zinc-500">No payment method</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
            {subscription.cancelAtPeriodEnd ? (
              <div>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-4">
                  Your subscription will end on <strong className="text-zinc-900 dark:text-white">{formatDate(subscription.currentPeriodEnd)}</strong>.
                  You can reactivate to keep your subscription.
                </p>
                <button
                  onClick={handleReactivateSubscription}
                  disabled={actionLoading}
                  className="w-full sm:w-auto px-6 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Reactivate Subscription
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div>
                <div className="mb-6">
                  <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">Want to change your plan?</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    To switch plans, cancel your current subscription and subscribe to a new plan once it ends on{" "}
                    <strong className="text-zinc-900 dark:text-white">{formatDate(subscription.currentPeriodEnd)}</strong>.
                  </p>
                </div>
                <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  <button
                    onClick={handleOpenCancelModal}
                    disabled={actionLoading}
                    className="text-sm text-zinc-400 hover:text-red-500 dark:hover:text-red-400 underline underline-offset-2 transition disabled:opacity-50"
                  >
                    Cancel subscription
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 max-w-md w-full">
            <div className="p-5 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Cancel Subscription</h3>
                <button
                  onClick={handleCloseCancelModal}
                  className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition"
                >
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Please let us know why you're cancelling.
              </p>
            </div>

            <div className="p-5 space-y-2">
              {CANCEL_REASONS.map((reason) => (
                <label
                  key={reason.id}
                  className={`flex items-center p-3 rounded-lg border cursor-pointer transition ${
                    selectedReason === reason.id
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                      : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="cancelReason"
                    value={reason.id}
                    checked={selectedReason === reason.id}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="ml-3 text-sm text-zinc-900 dark:text-white">{reason.label}</span>
                </label>
              ))}

              {selectedReason === "other" && (
                <textarea
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Please tell us more..."
                  rows={3}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
                />
              )}
            </div>

            <div className="p-5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 rounded-b-xl">
              <div className="flex gap-3">
                <button
                  onClick={handleCloseCancelModal}
                  className="flex-1 px-4 py-2.5 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-lg font-medium hover:bg-zinc-100 dark:hover:bg-zinc-700 transition text-sm"
                >
                  Keep Subscription
                </button>
                <button
                  onClick={handleCancelSubscription}
                  disabled={actionLoading || !selectedReason || (selectedReason === "other" && !customReason.trim())}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm"
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Cancelling...
                    </>
                  ) : (
                    "Cancel Subscription"
                  )}
                </button>
              </div>
              <p className="text-xs text-zinc-500 text-center mt-3">
                Access until {formatDate(subscription.currentPeriodEnd)}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
