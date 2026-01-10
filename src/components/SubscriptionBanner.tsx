 'use client';

import { useState, useEffect } from 'react';
import { X, Zap, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';

export default function SubscriptionBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [tokens, setTokens] = useState<number | null>(null);
  const router = useRouter();
  const { user, isLoaded } = useUser();

  useEffect(() => {
    const fetchTokens = async () => {
      if (!isLoaded || !user?.id) return;

      try {
        const response = await fetch('/api/tokens/balance');
        if (response.ok) {
          const data = await response.json();
          setTokens(data.balance ?? 0);

          // Show banner if tokens are low (less than 100)
          if (data.balance < 100) {
            setIsVisible(true);
          }
        }
      } catch (error) {
        console.error('Error fetching tokens:', error);
      }
    };

    fetchTokens();
  }, [user?.id, isLoaded]);

  if (!isVisible || tokens === null) return null;

  return (
    <div className="relative w-full max-w-5xl mx-auto mb-8 px-4">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#6c47ff] via-[#8b5cf6] to-[#a855f7] p-[2px] shadow-2xl shadow-purple-500/30">
        <div className="relative bg-gradient-to-r from-[#6c47ff] via-[#8b5cf6] to-[#a855f7] rounded-2xl p-6 md:p-8">
          {/* Close button */}
          <button
            onClick={() => setIsVisible(false)}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
            aria-label="Close banner"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col md:flex-row items-center gap-6">
            {/* Icon */}
            <div className="flex-shrink-0">
              <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Zap className="w-8 h-8 text-white" fill="white" />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">
                {tokens === 0 ? "You're out of tokens!" : "Running low on tokens?"}
              </h3>
              <p className="text-white/90 text-base md:text-lg">
                {tokens === 0
                  ? "Subscribe now to get tokens and continue creating amazing videos"
                  : `You have ${tokens} tokens left. Subscribe to get more tokens automatically every month!`
                }
              </p>
            </div>

            {/* CTA Button */}
            <div className="flex-shrink-0">
              <button
                onClick={() => router.push('/subscription')}
                className="group bg-white text-[#6c47ff] px-6 py-3 rounded-full font-semibold text-lg shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 flex items-center gap-2"
              >
                View Plans
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -z-10" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -z-10" />
        </div>
      </div>
    </div>
  );
}
