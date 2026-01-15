"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import SubscriptionForm from "../../components/SubscriptionForm";

function PricingPageContent() {
  const searchParams = useSearchParams();

  // Handle referral code from URL parameter
  useEffect(() => {
    const referralCodeParam = searchParams.get("r");
    if (referralCodeParam) {
      // Verify and save referral code to sessionStorage
      const verifyReferral = async () => {
        try {
          const response = await fetch(`/api/referral/verify?code=${encodeURIComponent(referralCodeParam)}`);
          const data = await response.json();

          if (data.valid) {
            sessionStorage.setItem("referral_code", referralCodeParam);
          } else {
            sessionStorage.removeItem("referral_code");
          }
        } catch (err) {
          console.error("Failed to verify referral:", err);
          sessionStorage.removeItem("referral_code");
        }
      };

      verifyReferral();
    }
  }, [searchParams]);

  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      <SubscriptionForm />
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-12 max-w-6xl">
          <div className="flex flex-col items-center justify-center p-12 bg-white/5 rounded-xl">
            <div className="w-5 h-5 border-2 border-zinc-500 border-t-white rounded-full animate-spin mb-3" />
            <p className="text-xs text-zinc-500">Loading...</p>
          </div>
        </div>
      }
    >
      <PricingPageContent />
    </Suspense>
  );
}
