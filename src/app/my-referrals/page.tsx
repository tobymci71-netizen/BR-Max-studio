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
  Link2,
  Crown,
  Percent,
  Calendar,
  LucideIcon,
} from "lucide-react";

/* ===================== TYPES ===================== */

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
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}


/* ===================== PAGE ===================== */

export default function MyReferralsPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [hasReferral, setHasReferral] = useState(false);
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ===================== EFFECT ===================== */

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      router.push("/sign-in");
      return;
    }
    fetchReferralData();
  }, [isLoaded, user, router]);

  /* ===================== DATA ===================== */

  const fetchReferralData = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/referral/my-referral");
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to fetch referral data");

      setHasReferral(data.hasReferral);
      if (data.hasReferral) {
        setReferralData(data.referral);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  /* ===================== HELPERS ===================== */

  const copy = async (text: string, setter: (v: boolean) => void) => {
    await navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 1500);
  };

  const sum = (paid?: boolean) =>
    referralData?.referral_payments
      .filter(p => paid === undefined || p.isPaid === paid)
      .reduce((a, b) => a + b.amountToPay, 0) ?? 0;

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  /* ===================== STATES ===================== */

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <p>{error}</p>
          <button onClick={fetchReferralData} className="mt-4 underline">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!hasReferral) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center">
        <div>
          <Link2 className="w-10 h-10 mx-auto mb-4 text-zinc-400" />
          <p className="mb-4">You don’t have a referral code yet.</p>
          <a href="https://discord.gg/your-discord-link" target="_blank">
            Contact Support
          </a>
        </div>
      </div>
    );
  }

  /* ===================== UI ===================== */
  if(true) {
    return null;
  }
  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
        <Crown className="w-6 h-6" /> Referral Dashboard
      </h1>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-4 mb-8">
        <Stat label="Referrals" value={referralData!.total_referrals_count} icon={Users} />
        <Stat label="Total Earned" value={`$${sum().toFixed(2)}`} icon={DollarSign} />
        <Stat label="Paid" value={`$${sum(true).toFixed(2)}`} icon={Check} />
        <Stat label="Pending" value={`$${sum(false).toFixed(2)}`} icon={TrendingUp} />
      </div>

      {/* Referral Link */}
      <div className="rounded-xl border border-white border-solid text-white p-6 mb-10">
        <p className="text-sm mb-1">Referral Code</p>
        <div className="flex justify-between items-center">
          <span className="font-mono text-xl">{referralData!.referral_code}</span>
          <button onClick={() => copy(referralData!.referral_code, setCopiedCode)}>
            {copiedCode ? <Check /> : <Copy />}
          </button>
        </div>

        <p className="text-sm mt-4 mb-1">Referral Link</p>
        <div className="flex justify-between items-center">
          <span className="font-mono truncate">{referralData!.referral_link}</span>
          <button onClick={() => copy(referralData!.referral_link, setCopiedLink)}>
            {copiedLink ? <Check /> : <Copy />}
          </button>
        </div>

        <div className="flex gap-6 mt-4 text-sm">
          <span className="flex gap-1 items-center">
            <Percent className="w-4 h-4" /> {referralData!.commission_percentage}%
          </span>
          <span className="flex gap-1 items-center">
            <Calendar className="w-4 h-4" /> Since {formatDate(referralData!.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ===================== COMPONENT ===================== */
interface StatProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
}

function Stat({ label, value, icon: Icon }: StatProps) {
  return (
    <div className="border rounded-xl p-4">
      <Icon className="w-5 h-5 mb-2 text-zinc-500" />
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
