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

export default function SubscriptionPage() {
  const router = useRouter()
  const { user, isLoaded: userLoaded } = useUser()
  const [loading, setLoading] = useState(true)
  const [hasSubscription, setHasSubscription] = useState(false)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

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

  const handleCancelSubscription = async () => {
    if (
      !confirm(
        "Are you sure you want to cancel your subscription? You'll retain access until the end of your billing period.",
      )
    ) {
      return
    }

    try {
      setActionLoading(true)
      setError("")
      setSuccessMessage("")

      const response = await fetch("/api/stripe/subscription/cancel", {
        method: "POST",
      })

      const data = await response.json()

      if (response.ok) {
        setSuccessMessage("Subscription will be cancelled at the end of your billing period")
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-slate-400 dark:text-slate-600 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Loading subscription details...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card dark:bg-card rounded-lg border border-border dark:border-border p-8 text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Authentication Required</h1>
          <p className="text-muted-foreground mb-6">Please sign in to view your subscription details.</p>
          <button
            onClick={() => router.push("/sign-in")}
            className="w-full bg-primary dark:bg-primary text-primary-foreground dark:text-primary-foreground py-3 rounded-lg font-semibold hover:opacity-90 transition"
          >
            Sign In
          </button>
        </div>
      </div>
    )
  }

  if (!hasSubscription || !subscription) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card dark:bg-card rounded-lg border border-border dark:border-border p-8 text-center">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-slate-600 dark:text-slate-400" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">No Active Subscription</h1>
          <p className="text-muted-foreground mb-2">
            Hi <strong>{user.firstName || user.username || "there"}</strong>!
          </p>
          <p className="text-muted-foreground mb-6">
            You don't have an active subscription. Subscribe to unlock premium features and get monthly tokens.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => router.push("/pricing")}
              className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold hover:opacity-90 transition"
            >
              View Pricing Plans
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className="w-full border border-border text-foreground py-3 rounded-lg font-semibold hover:bg-secondary transition"
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
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center text-muted-foreground hover:text-foreground mb-4 transition"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Studio
          </button>
          <h1 className="text-4xl font-bold text-foreground">Subscription Management</h1>
          <p className="text-muted-foreground mt-2">Manage your subscription and billing</p>
        </div>

        {/* Account Info Banner */}
        <div className="mb-6 bg-secondary dark:bg-secondary/50 border border-border rounded-lg p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-300 dark:bg-slate-700 rounded-full flex items-center justify-center text-foreground font-bold text-lg">
              {user.firstName?.charAt(0) ||
                user.username?.charAt(0) ||
                user.emailAddresses[0]?.emailAddress.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-foreground">
                {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.username || "User"}
              </h2>
              <p className="text-sm text-muted-foreground">{user.emailAddresses[0]?.emailAddress || "No email"}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">User ID</p>
              <p className="text-xs font-mono text-foreground">{user.id.slice(-8).toUpperCase()}</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-3 flex-shrink-0 mt-0.5" />
            <p className="text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start">
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mr-3 flex-shrink-0 mt-0.5" />
            <p className="text-green-800 dark:text-green-300">{successMessage}</p>
          </div>
        )}

        {/* Subscription Status Card */}
        <div className="bg-card dark:bg-card rounded-lg border border-border dark:border-border overflow-hidden mb-6">
          <div className="bg-slate-100 dark:bg-slate-900 p-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-1">{subscription.packageName}</h2>
                <p className="text-muted-foreground">Your Current Plan</p>
                {subscription.stripeSubscriptionId && (
                  <p className="text-xs text-muted-foreground mt-2 font-mono">
                    Sub ID: {subscription.stripeSubscriptionId.slice(0, 20)}...
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {getStatusBadge()}
                <button
                  onClick={() => fetchSubscription()}
                  disabled={loading}
                  className="p-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-lg transition"
                  title="Refresh subscription data"
                >
                  <RefreshCw className={`w-4 h-4 text-foreground ${loading ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Tokens */}
              <div className="bg-slate-50 dark:bg-slate-900/50 border border-border rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <Coins className="w-5 h-5 text-slate-600 dark:text-slate-400 mr-2" />
                  <h3 className="font-semibold text-foreground">Monthly Tokens</h3>
                </div>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">
                  {subscription.tokens.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground mt-1">Tokens per month</p>
              </div>

              {/* Price */}
              <div className="bg-slate-50 dark:bg-slate-900/50 border border-border rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <DollarSign className="w-5 h-5 text-slate-600 dark:text-slate-400 mr-2" />
                  <h3 className="font-semibold text-foreground">Monthly Price</h3>
                </div>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">${subscription.price}/mo</p>
                <p className="text-sm text-muted-foreground mt-1">Billed monthly</p>
              </div>

              {/* Next Billing Date */}
              <div className="border border-border rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <Calendar className="w-5 h-5 text-muted-foreground mr-2" />
                  <h3 className="font-semibold text-foreground">
                    {subscription.cancelAtPeriodEnd ? "Access Until" : "Next Billing Date"}
                  </h3>
                </div>
                <p className="text-xl font-semibold text-foreground">{formatDate(subscription.currentPeriodEnd)}</p>
                {subscription.cancelAtPeriodEnd && (
                  <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">Subscription ends on this date</p>
                )}
              </div>

              {/* Payment Method */}
              <div className="border border-border rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <CreditCard className="w-5 h-5 text-muted-foreground mr-2" />
                  <h3 className="font-semibold text-foreground">Payment Method</h3>
                </div>
                {subscription.paymentMethod ? (
                  <>
                    <p className="text-xl font-semibold text-foreground capitalize">
                      {subscription.paymentMethod.brand} •••• {subscription.paymentMethod.last4}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Expires {subscription.paymentMethod.expMonth}/{subscription.paymentMethod.expYear}
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">No payment method on file</p>
                )}
              </div>
            </div>

            {/* Billing Period */}
            <div className="mt-6 pt-6 border-t border-border">
              <h3 className="font-semibold text-foreground mb-3">Current Billing Period</h3>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Started:</span>
                <span className="font-medium text-foreground">{formatDate(subscription.currentPeriodStart)}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-muted-foreground">Ends:</span>
                <span className="font-medium text-foreground">{formatDate(subscription.currentPeriodEnd)}</span>
              </div>
            </div>

            {/* Subscription Details */}
            <div className="mt-6 pt-6 border-t border-border">
              <h3 className="font-semibold text-foreground mb-3">Subscription Details</h3>
              <div className="space-y-2 text-xs">
                {subscription.stripeCustomerId && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Customer ID:</span>
                    <span className="font-mono text-foreground">{subscription.stripeCustomerId.slice(0, 15)}...</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Subscription ID:</span>
                  <span className="font-mono text-foreground">{subscription.stripeSubscriptionId.slice(0, 15)}...</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="text-foreground capitalize">{subscription.status}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-card dark:bg-card rounded-lg border border-border dark:border-border p-6">
          <h3 className="text-xl font-bold text-foreground mb-4">Manage Subscription</h3>

          {subscription.cancelAtPeriodEnd ? (
            <div className="space-y-4">
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                <p className="text-orange-800 dark:text-orange-300 mb-3">
                  Your subscription is set to cancel on <strong>{formatDate(subscription.currentPeriodEnd)}</strong>.
                  You can reactivate it to continue your subscription.
                </p>
                <button
                  onClick={handleReactivateSubscription}
                  disabled={actionLoading}
                  className="flex items-center justify-center w-full md:w-auto px-6 py-3 bg-green-600 dark:bg-green-700 text-white rounded-lg font-semibold hover:bg-green-700 dark:hover:bg-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
              <div className="bg-secondary dark:bg-secondary/50 border border-border rounded-lg p-4">
                <h4 className="font-semibold text-foreground mb-3">Want to change your plan?</h4>
                <p className="text-muted-foreground mb-4">You can upgrade or downgrade your subscription anytime.</p>
                <button
                  onClick={() => router.push("/pricing")}
                  className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition"
                >
                  View Plans
                </button>
              </div>

              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <h4 className="font-semibold text-foreground mb-3">Cancel Subscription</h4>
                <p className="text-muted-foreground mb-4 text-sm">
                  We'll be sad to see you go, but you can cancel anytime. You'll retain access until the end of your
                  billing period.
                </p>
                <button
                  onClick={handleCancelSubscription}
                  disabled={actionLoading}
                  className="flex items-center justify-center w-full md:w-auto px-6 py-3 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 rounded-lg font-semibold hover:bg-red-50 dark:hover:bg-red-900/30 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Cancel Subscription"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
