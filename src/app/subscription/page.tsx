"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
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
} from "lucide-react";

interface PaymentMethod {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

interface Subscription {
  id: string;
  packageId: string;
  packageName: string;
  tokens: number;
  price: number;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  paymentMethod: PaymentMethod | null;
}

export default function SubscriptionPage() {
  const router = useRouter();
  const { user, isLoaded: userLoaded } = useUser();
  const [loading, setLoading] = useState(true);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const fetchSubscription = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/stripe/subscription/get");
      const data = await response.json();

      if (response.ok) {
        console.log("Subscription data received:", data);
        setHasSubscription(data.hasSubscription);
        setSubscription(data.subscription);
      } else {
        if (response.status === 401) {
          setError("Please sign in to view your subscription");
        } else {
          setError(data.error || "Failed to fetch subscription");
        }
      }
    } catch (err) {
      console.error("Error fetching subscription:", err);
      setError("Failed to load subscription data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userLoaded) {
      if (user) {
        fetchSubscription();
      } else {
        setLoading(false);
        setError("Please sign in to view your subscription");
      }
    }
  }, [user, userLoaded]);

  const handleCancelSubscription = async () => {
    if (!confirm("Are you sure you want to cancel your subscription? You'll retain access until the end of your billing period.")) {
      return;
    }

    try {
      setActionLoading(true);
      setError("");
      setSuccessMessage("");

      const response = await fetch("/api/stripe/subscription/cancel", {
        method: "POST",
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage("Subscription will be cancelled at the end of your billing period");
        await fetchSubscription();
      } else {
        setError(data.error || "Failed to cancel subscription");
      }
    } catch (err) {
      console.error("Error cancelling subscription:", err);
      setError("Failed to cancel subscription");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivateSubscription = async () => {
    try {
      setActionLoading(true);
      setError("");
      setSuccessMessage("");

      const response = await fetch("/api/stripe/subscription/reactivate", {
        method: "POST",
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage("Subscription has been reactivated!");
        await fetchSubscription();
      } else {
        setError(data.error || "Failed to reactivate subscription");
      }
    } catch (err) {
      console.error("Error reactivating subscription:", err);
      setError("Failed to reactivate subscription");
    } finally {
      setActionLoading(false);
    }
  };

  if (!userLoaded || loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-purple-600 dark:text-purple-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading subscription details...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800 p-8 text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Authentication Required</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Please sign in to view your subscription details.
          </p>
          <button
            onClick={() => router.push("/sign-in")}
            className="w-full bg-purple-600 dark:bg-purple-500 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 dark:hover:bg-purple-600 transition"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  if (!hasSubscription || !subscription) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800 p-8 text-center">
          <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-purple-600 dark:text-purple-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No Active Subscription</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            Hi <strong>{user.firstName || user.username || "there"}</strong>!
          </p>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            You don't have an active subscription. Subscribe to unlock premium features and get monthly tokens.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => router.push("/pricing")}
              className="w-full bg-purple-600 dark:bg-purple-500 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 dark:hover:bg-purple-600 transition"
            >
              View Pricing Plans
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className="w-full border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-gray-300 py-3 rounded-lg font-semibold hover:bg-gray-50 dark:hover:bg-zinc-800 transition"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const nextBillingDate = new Date(subscription.currentPeriodEnd);
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusBadge = () => {
    if (subscription.cancelAtPeriodEnd) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">
          <XCircle className="w-3 h-3 mr-1" />
          Cancelling Soon
        </span>
      );
    }
    if (subscription.status === "active") {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Active
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
        {subscription.status}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-transparent py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4 transition"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Subscription Management</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your subscription and billing</p>
        </div>

        {/* Account Info Banner */}
        <div className="mb-6 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-600 dark:bg-purple-700 rounded-full flex items-center justify-center text-white font-bold text-lg">
              {user.firstName?.charAt(0) || user.username?.charAt(0) || user.emailAddresses[0]?.emailAddress.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-gray-900 dark:text-white">
                {user.firstName && user.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : user.username || "User"}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {user.emailAddresses[0]?.emailAddress || "No email"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 dark:text-gray-500">User ID</p>
              <p className="text-xs font-mono text-gray-600 dark:text-gray-400">{user.id.slice(-8).toUpperCase()}</p>
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
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800 overflow-hidden mb-6">
          <div className="bg-purple-600 dark:bg-purple-900 p-6 text-white">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-2xl font-bold mb-1">{subscription.packageName}</h2>
                <p className="text-purple-100 dark:text-purple-200">Your Current Plan</p>
                {subscription.stripeSubscriptionId && (
                  <p className="text-xs text-purple-200 dark:text-purple-300 mt-2 font-mono">
                    Sub ID: {subscription.stripeSubscriptionId.slice(0, 20)}...
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {getStatusBadge()}
                <button
                  onClick={() => fetchSubscription()}
                  disabled={loading}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
                  title="Refresh subscription data"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Tokens */}
              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <Coins className="w-5 h-5 text-purple-600 dark:text-purple-400 mr-2" />
                  <h3 className="font-semibold text-gray-800 dark:text-white">Monthly Tokens</h3>
                </div>
                <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {subscription.tokens.toLocaleString()}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Tokens per month</p>
              </div>

              {/* Price */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" />
                  <h3 className="font-semibold text-gray-800 dark:text-white">Monthly Price</h3>
                </div>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  ${subscription.price}/mo
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Billed monthly</p>
              </div>

              {/* Next Billing Date */}
              <div className="border border-gray-200 dark:border-zinc-700 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <Calendar className="w-5 h-5 text-gray-600 dark:text-gray-400 mr-2" />
                  <h3 className="font-semibold text-gray-800 dark:text-white">
                    {subscription.cancelAtPeriodEnd ? "Access Until" : "Next Billing Date"}
                  </h3>
                </div>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">
                  {formatDate(subscription.currentPeriodEnd)}
                </p>
                {subscription.cancelAtPeriodEnd && (
                  <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                    Subscription ends on this date
                  </p>
                )}
              </div>

              {/* Payment Method */}
              <div className="border border-gray-200 dark:border-zinc-700 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <CreditCard className="w-5 h-5 text-gray-600 dark:text-gray-400 mr-2" />
                  <h3 className="font-semibold text-gray-800 dark:text-white">Payment Method</h3>
                </div>
                {subscription.paymentMethod ? (
                  <>
                    <p className="text-xl font-semibold text-gray-900 dark:text-white capitalize">
                      {subscription.paymentMethod.brand} •••• {subscription.paymentMethod.last4}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Expires {subscription.paymentMethod.expMonth}/{subscription.paymentMethod.expYear}
                    </p>
                  </>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400">No payment method on file</p>
                )}
              </div>
            </div>

            {/* Billing Period */}
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-zinc-700">
              <h3 className="font-semibold text-gray-800 dark:text-white mb-3">Current Billing Period</h3>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Started:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatDate(subscription.currentPeriodStart)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-gray-600 dark:text-gray-400">Ends:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatDate(subscription.currentPeriodEnd)}
                </span>
              </div>
            </div>

            {/* Subscription Details */}
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-zinc-700">
              <h3 className="font-semibold text-gray-800 dark:text-white mb-3">Subscription Details</h3>
              <div className="space-y-2 text-xs">
                {subscription.stripeCustomerId && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Customer ID:</span>
                    <span className="font-mono text-gray-900 dark:text-white">
                      {subscription.stripeCustomerId.slice(0, 15)}...
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Subscription ID:</span>
                  <span className="font-mono text-gray-900 dark:text-white">
                    {subscription.stripeSubscriptionId.slice(0, 15)}...
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Status:</span>
                  <span className="text-gray-900 dark:text-white capitalize">
                    {subscription.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800 p-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Manage Subscription</h3>

          {subscription.cancelAtPeriodEnd ? (
            <div className="space-y-4">
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                <p className="text-orange-800 dark:text-orange-300 mb-3">
                  Your subscription is set to cancel on{" "}
                  <strong>{formatDate(subscription.currentPeriodEnd)}</strong>. You can
                  reactivate it to continue your subscription.
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
              <div className="bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Cancel Subscription</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  You can cancel your subscription at any time. You'll continue to have access
                  until the end of your current billing period.
                </p>
                <button
                  onClick={handleCancelSubscription}
                  disabled={actionLoading}
                  className="flex items-center justify-center w-full md:w-auto px-6 py-3 bg-red-600 dark:bg-red-700 text-white rounded-lg font-semibold hover:bg-red-700 dark:hover:bg-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 mr-2" />
                      Cancel Subscription
                    </>
                  )}
                </button>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Update Payment Method</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Manage your payment method through the Stripe customer portal
                </p>
                <button
                  onClick={async () => {
                    try {
                      setActionLoading(true);
                      const response = await fetch("/api/stripe/create-portal-session", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ returnUrl: window.location.href }),
                      });
                      const data = await response.json();
                      if (response.ok && data.url) {
                        window.location.href = data.url;
                      } else {
                        setError("Failed to open billing portal");
                      }
                    } catch (err) {
                      console.error("Error opening portal:", err);
                      setError("Failed to open billing portal");
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                  disabled={actionLoading}
                  className="inline-flex items-center px-6 py-3 bg-blue-600 dark:bg-blue-700 text-white rounded-lg font-semibold hover:bg-blue-700 dark:hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CreditCard className="w-5 h-5 mr-2" />
                  Manage Billing
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Help */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Need help?{" "}
            <a
              href="https://discord.gg/brmax"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-600 dark:text-purple-400 hover:underline font-medium"
            >
              Contact us on Discord
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
