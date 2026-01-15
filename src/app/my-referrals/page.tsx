"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Copy,
  Check,
  Users,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Crown,
  Calendar,
  Percent,
  Link2,
} from "lucide-react";

interface ReferralPayment {
  userId: string;
  subscriptionId: string;
  subscriptionAmount: number;
  paymentPercentage: number;
  amountToPay: number;
  isPaid: boolean;
  paidAt: string | null;
}

interface ReferralData {
  referral_id: string;
  referral_code: string;
  referral_link: string;
  commission_percentage: number;
  total_referrals_count: number;
  referred_user_ids: string[];
  paid_user_ids: string[];
  referral_payments: ReferralPayment[];
  status: string;
  created_at: string;
  updated_at: string;
}

export default function MyReferralsPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [hasReferral, setHasReferral] = useState(false);
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    if (!user) {
      router.push("/sign-in");
      return;
    }

    fetchReferralData();
  }, [user, isLoaded, router]);

  const fetchReferralData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/referral/my-referral");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch referral data");
      }

      setHasReferral(data.hasReferral);
      if (data.hasReferral) {
        setReferralData(data.referral);
      }
    } catch (err) {
      console.error("Error fetching referral data:", err);
      setError(err instanceof Error ? err.message : "Failed to load referral data");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!referralData) return;

    try {
      await navigator.clipboard.writeText(referralData.referral_link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleCopyCode = async () => {
    if (!referralData) return;

    try {
      await navigator.clipboard.writeText(referralData.referral_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const calculateTotalEarnings = () => {
    if (!referralData) return 0;
    return referralData.referral_payments.reduce((sum, payment) => sum + payment.amountToPay, 0);
  };

  const calculatePaidEarnings = () => {
    if (!referralData) return 0;
    return referralData.referral_payments
      .filter((p) => p.isPaid)
      .reduce((sum, payment) => sum + payment.amountToPay, 0);
  };

  const calculateUnpaidEarnings = () => {
    if (!referralData) return 0;
    return referralData.referral_payments
      .filter((p) => !p.isPaid)
      .reduce((sum, payment) => sum + payment.amountToPay, 0);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-400 mx-auto mb-4" />
          <p className="text-zinc-500 dark:text-zinc-400">Loading your referral data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center">
          <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Error</h1>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">{error}</p>
          <button
            onClick={fetchReferralData}
            className="w-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 py-3 rounded-lg font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!hasReferral) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center">
          <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Link2 className="w-7 h-7 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
            No Referral Code Yet
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            You don't have a referral code yet. To get started with our referral program, please contact our support team.
          </p>
          <a
            href="https://discord.gg/h4chRAbjEZ"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 w-full bg-[#5865F2] text-white py-3 px-4 rounded-lg font-semibold hover:bg-[#4752C4] transition justify-center"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            Open Discord Ticket
          </a>
          <button
            onClick={() => router.push("/")}
            className="w-full mt-3 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 py-3 rounded-lg font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const totalEarnings = calculateTotalEarnings();
  const paidEarnings = calculatePaidEarnings();
  const unpaidEarnings = calculateUnpaidEarnings();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">My Referrals</h1>
          </div>
          <p className="text-zinc-600 dark:text-zinc-400">
            Track your referrals and earnings
          </p>
        </div>

        {/* Status Badge */}
        {referralData && (
          <div className="mb-6">
            <span
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                referralData.status === "active"
                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                  : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  referralData.status === "active" ? "bg-green-500" : "bg-zinc-500"
                }`}
              />
              {referralData.status === "active" ? "Active" : "Inactive"}
            </span>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Total Referrals</p>
            </div>
            <p className="text-3xl font-bold text-zinc-900 dark:text-white">
              {referralData?.total_referrals_count || 0}
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Total Earnings</p>
            </div>
            <p className="text-3xl font-bold text-zinc-900 dark:text-white">
              ${totalEarnings.toFixed(2)}
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
                <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Paid</p>
            </div>
            <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
              ${paidEarnings.toFixed(2)}
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Pending</p>
            </div>
            <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
              ${unpaidEarnings.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Referral Link Card */}
        {referralData && (
          <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl p-6 mb-8 text-white">
            <div className="flex items-center gap-2 mb-4">
              <Link2 className="w-5 h-5" />
              <h2 className="text-xl font-bold">Your Referral Link</h2>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/70 mb-1">Referral Code</p>
                  <p className="font-mono text-lg font-bold truncate">{referralData.referral_code}</p>
                </div>
                <button
                  onClick={handleCopyCode}
                  className="flex-shrink-0 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition flex items-center gap-2"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span className="text-sm font-medium">Copy Code</span>
                </button>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/70 mb-1">Full Link</p>
                  <p className="font-mono text-sm truncate">{referralData.referral_link}</p>
                </div>
                <button
                  onClick={handleCopyLink}
                  className="flex-shrink-0 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition flex items-center gap-2"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span className="text-sm font-medium">Copy Link</span>
                </button>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Percent className="w-4 h-4" />
                <span>Commission: {referralData.commission_percentage}%</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>Since: {formatDate(referralData.created_at)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Referral Payments List */}
        {referralData && referralData.referral_payments.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Referral History</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                {referralData.referral_payments.length} total referral{referralData.referral_payments.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {referralData.referral_payments.map((payment, idx) => (
                <div
                  key={`${payment.userId}-${idx}`}
                  className={`p-6 ${
                    payment.isPaid
                      ? "bg-green-50 dark:bg-green-900/10"
                      : "bg-white dark:bg-zinc-900"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                            payment.isPaid
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                          }`}
                        >
                          {payment.isPaid ? (
                            <>
                              <Check className="w-3 h-3" />
                              Paid
                            </>
                          ) : (
                            <>
                              <TrendingUp className="w-3 h-3" />
                              Pending
                            </>
                          )}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-zinc-500 dark:text-zinc-400">Subscription</p>
                          <p className="font-semibold text-zinc-900 dark:text-white">
                            ${payment.subscriptionAmount.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-zinc-500 dark:text-zinc-400">Commission</p>
                          <p className="font-semibold text-zinc-900 dark:text-white">
                            {payment.paymentPercentage}%
                          </p>
                        </div>
                        <div>
                          <p className="text-zinc-500 dark:text-zinc-400">Your Earning</p>
                          <p className="font-semibold text-zinc-900 dark:text-white">
                            ${payment.amountToPay.toFixed(2)}
                          </p>
                        </div>
                        {payment.paidAt && (
                          <div>
                            <p className="text-zinc-500 dark:text-zinc-400">Paid On</p>
                            <p className="font-semibold text-zinc-900 dark:text-white">
                              {formatDate(payment.paidAt)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {referralData && referralData.referral_payments.length === 0 && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-12 text-center">
            <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-zinc-400" />
            </div>
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
              No Referrals Yet
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
              Share your referral link to start earning commissions!
            </p>
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-6 py-3 rounded-lg font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              Copy Referral Link
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
