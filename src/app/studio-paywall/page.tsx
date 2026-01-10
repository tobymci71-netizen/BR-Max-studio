"use client"
import TokenPurchaseForm from "@/components/TokenPurchaseForm"
import { Lock, Check, Zap, Shield } from "lucide-react"

export default function StudioPaywall() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex items-center justify-center min-h-screen py-8 px-4">
        <div className="w-full max-w-full px-4">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 border border-white/10 mb-4">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2 text-white">Unlock Studio Access</h1>
            <p className="text-sm text-white/60 max-w-2xl mx-auto">
              Choose a package to activate your account and start creating professional videos
            </p>
          </div>

          <div className="grid lg:grid-cols-[2fr_1fr] gap-6 max-w-7xl mx-auto">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
              <div className="border-b border-white/10 px-6 py-4 bg-white/[0.02]">
                <h3 className="text-lg font-bold text-white">Select Your Package</h3>
                <p className="text-xs text-white/50 mt-1">All packages include instant access and full features</p>
              </div>
              <div className="p-6">
                <TokenPurchaseForm />
              </div>
              <div className="border-t border-white/10 px-6 py-4 bg-white/[0.03]">
                <div className="flex flex-wrap gap-4 text-xs">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-white/60" />
                    <span className="text-white/70 font-medium">Secure Payment</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-white/60" />
                    <span className="text-white/70 font-medium">Instant Delivery</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-white/60" />
                    <span className="text-white/70 font-medium">No Recurring Charges</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {/* <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <div className="flex items-center gap-3 mb-4">
                  <svg className="w-5 h-5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <h4 className="text-base font-bold text-white">What's Included</h4>
                </div>
                <ul className="space-y-3">
                  {[
                    "Instant studio access",
                    "GPU-powered rendering",
                    "High-quality 4K exports",
                    "Commercial usage rights",
                    "Priority processing",
                  ].map((benefit, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-white/40 flex-shrink-0" />
                      <span className="text-white/70">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div> */}

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-white/60 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-white mb-1">Secure & Instant</h4>
                    <p className="text-xs text-white/60 leading-relaxed">
                      Your studio unlocks automatically after payment confirmation. All transactions are encrypted and
                      secure.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
