"use client"
import { Lock, Wrench, AlertTriangle } from "lucide-react"

export default function StudioPaywall() {
  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Yellow caution tape - realistic diagonal stripes */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        

        {/* Third tape strip - top */}
        <div className="absolute -right-20 top-16 w-[140%] h-20 transform rotate-[10deg] origin-top-right">
          <div className="absolute inset-0 bg-gradient-to-b from-yellow-400 via-yellow-500 to-yellow-600 shadow-[0_8px_32px_rgba(0,0,0,0.6)]" style={{
            backgroundImage: 'repeating-linear-gradient(90deg, #facc15 0px, #facc15 80px, #eab308 80px, #eab308 160px)',
          }}>
            <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-black/40" />
            <div className="absolute inset-0 flex items-center justify-around text-black font-black text-base tracking-[0.3em] py-1" style={{ textShadow: '1px 1px 0px rgba(255,255,255,0.3)' }}>
              <span className="whitespace-nowrap">⚠ UNDER CONSTRUCTION ⚠</span>
              <span className="whitespace-nowrap">⚠ UNDER CONSTRUCTION ⚠</span>
              <span className="whitespace-nowrap">⚠ UNDER CONSTRUCTION ⚠</span>
              <span className="whitespace-nowrap">⚠ UNDER CONSTRUCTION ⚠</span>
            </div>
          </div>
          {/* Tape shadow underneath */}
          <div className="absolute -bottom-2 inset-x-0 h-3 bg-black/40 blur-md" />
        </div>
      </div>

      <div className="flex items-center justify-center min-h-screen py-8 px-4 relative z-10">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            {/* Icon container with construction theme */}
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-yellow-500/10 border-2 border-yellow-500/30 mb-6 relative">
              <Lock className="w-10 h-10 text-yellow-500" />
              <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center">
                <Wrench className="w-5 h-5 text-black" />
              </div>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">
              Payment Gateway
              <br />
              <span className="text-yellow-500">Under Construction</span>
            </h1>
            
            <p className="text-lg text-white/70 max-w-xl mx-auto mb-8 leading-relaxed">
              Our payment system is currently being upgraded to serve you better. We'll be back online very soon.
            </p>
          </div>

          {/* Info cards */}
          <div className="space-y-4 mb-8">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Studio Access for Paid Users Only</h3>
                  <p className="text-sm text-white/60 leading-relaxed">
                    Our studio is a premium service available exclusively to paid subscribers. Once the payment gateway is restored, you'll be able to unlock full access to all professional features.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <Wrench className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">We're Working Hard</h3>
                  <p className="text-sm text-white/60 leading-relaxed">
                    Our team is actively working on improvements to provide you with a smoother, more secure payment experience. Thank you for your patience.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Status banner */}
          <div className="rounded-xl border border-yellow-500/20 bg-gradient-to-r from-yellow-500/5 to-yellow-500/10 p-4">
            <div className="flex items-center justify-center gap-3 text-yellow-500">
              <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
              <span className="text-sm font-medium">Expected to be back online shortly</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}