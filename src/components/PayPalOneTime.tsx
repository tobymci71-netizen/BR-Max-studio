"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { ArrowLeft, ShieldCheck, ExternalLink } from "lucide-react";
import {
  calculateTokenPrice,
  TokenPriceBreakdown,
  DiscountTier,
} from "@/lib/tokenPricing";
import Link from "next/link";

interface PricingState {
  tokens: number;
  priceUsd: number;
  formattedPrice: string;
  usdPer100: number;
  discountPercent: number;
  discountAmount: number;
  effectiveUsdPer100: number;
  tier: DiscountTier | null;
}

const mapBreakdownToState = (breakdown: TokenPriceBreakdown): PricingState => ({
  tokens: breakdown.tokens,
  priceUsd: breakdown.finalCost,
  formattedPrice: breakdown.finalCost.toFixed(2),
  usdPer100: breakdown.usdPer100,
  discountPercent: breakdown.discountPercent,
  discountAmount: breakdown.discountAmount,
  effectiveUsdPer100: breakdown.effectiveUsdPer100,
  tier: breakdown.tier ?? null,
});

export default function PayPalOneTime() {
  const { userId } = useAuth();

  const [tokenAmount, setTokenAmount] = useState<number>(500);
  const [pricing, setPricing] = useState<PricingState>(() =>
    mapBreakdownToState(calculateTokenPrice(500)),
  );
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);

  useEffect(() => {
    const sanitizedTokens = Math.max(0, Math.floor(tokenAmount));
    const fallbackBreakdown = calculateTokenPrice(sanitizedTokens);
    setPricing(mapBreakdownToState(fallbackBreakdown));

    if (sanitizedTokens < 100) {
      setPricingError("Minimum 100 tokens required for a one-time purchase.");
      setPricingLoading(false);
      return;
    }

    let cancelled = false;
    setPricingLoading(true);
    setPricingError(null);

    fetch(`/api/paypal/pricing?tokens=${sanitizedTokens}`)
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;

        if (res.ok && data?.priceUsd != null) {
          setPricing({
            tokens: Number(data.tokensRequested ?? sanitizedTokens),
            priceUsd: Number(data.priceUsd),
            formattedPrice:
              data.formattedPrice ??
              Number(data.priceUsd ?? sanitizedTokens * 0.01).toFixed(2),
            usdPer100: Number(data.usdPer100 ?? fallbackBreakdown.usdPer100),
            discountPercent: Number(data.discountPercent ?? 0),
            discountAmount: Number(data.discountAmount ?? 0),
            effectiveUsdPer100: Number(
              data.effectiveUsdPer100 ??
                data.usdPer100 ??
                fallbackBreakdown.effectiveUsdPer100,
            ),
            tier: data.tier ?? null,
          });
        } else {
          console.error("Pricing API error:", data);
          setPricingError("Unable to retrieve pricing. Please try again.");
        }
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Pricing lookup failed:", error);
        setPricingError("Unable to retrieve pricing. Please check your connection.");
      })
      .finally(() => {
        if (!cancelled) {
          setPricingLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tokenAmount]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sanitized = parseInt(e.target.value.replace(/\D/g, ""), 10);
    setTokenAmount(Number.isNaN(sanitized) ? 0 : sanitized);
  };

  const hasDiscount = pricing.discountPercent > 0;

  if (!userId) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="bg-white dark:bg-[#101114] border border-foreground/10 p-8 rounded-xl max-w-md text-center">
          <p className="text-xl font-semibold text-foreground">Sign in to buy tokens</p>
          <p className="text-sm text-foreground/60 mt-2">
            We need to associate your purchase with your account before you can checkout.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center pt-10 px-4">
      <div className="w-full max-w-md mb-6">
        <Link
          href="/"
          className="flex items-center cursor-pointer gap-2 text-foreground/50 hover:text-foreground/80 text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
      </div>

      <div className="w-full max-w-md bg-white dark:bg-[#101114] border border-foreground/10 rounded-xl p-6 shadow-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-1">Buy Tokens</h1>
          <p className="text-sm text-foreground/60">
            Pay as you go. No monthly commitment.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-foreground/50 mb-2">
              How many tokens would you like?
            </label>
            <div className="relative">
              <input
                type="text"
                value={tokenAmount || ""}
                onChange={handleInputChange}
                placeholder="e.g. 500"
                className="w-full bg-background border border-foreground/10 rounded-lg px-4 py-3 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-foreground/40">
                tokens
              </div>
            </div>
            {tokenAmount < 100 && tokenAmount > 0 && (
              <p className="text-xs text-amber-600 mt-1.5">Minimum 100 tokens required</p>
            )}
          </div>

          {/* Total Cost Card */}
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border border-purple-200 dark:border-purple-800/50 rounded-lg p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50 mb-1">
                  Total Cost
                </p>
                <p className="text-3xl font-bold text-purple-600">
                  ${pricing.formattedPrice}
                </p>
              </div>
              {pricingLoading && (
                <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
              )}
            </div>

            {hasDiscount && (
              <div className="mt-3 pt-3 border-t border-purple-200/50 dark:border-purple-800/50">
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  🎉 {pricing.discountPercent}% bulk discount applied
                  {pricing.discountAmount > 0 && (
                    <span className="text-foreground/60"> (${pricing.discountAmount.toFixed(2)} off)</span>
                  )}
                </p>
              </div>
            )}
          </div>

          {pricingError && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <p className="text-xs text-amber-700 dark:text-amber-300">{pricingError}</p>
            </div>
          )}
        </div>

        {/* Payment Instructions */}
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-sm font-semibold text-foreground mb-1">
                  PayPal Payment
                </p>
                <p className="text-xs text-foreground/70 leading-relaxed">
                  Send <span className="font-semibold text-purple-600">${pricing.formattedPrice}</span> via PayPal, then open a support ticket on Discord to receive your tokens.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <a
                  href={`http://paypal.me/paybrmax/${pricing.formattedPrice}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#0070ba] hover:bg-[#005ea6] text-white text-sm font-medium transition-colors"
                >
                  Send ${pricing.formattedPrice} via PayPal
                  <ExternalLink className="w-4 h-4" />
                </a>

                <a
                  href="https://discord.gg/h4chRAbjEZ"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-medium transition-colors"
                >
                  Open Support Ticket
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md p-3">
                <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                  <span className="font-semibold">Important:</span> Include your payment confirmation in your support ticket. Tokens are manually credited after verification.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}