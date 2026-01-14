"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
} from "@clerk/nextjs";
import { useAppContext } from "@/context/AppContext";
import { Sparkles, Moon, Coins, Loader2 } from "lucide-react";
import { CountUp } from "@/components/CountUp";
import Link from "next/link";
import { useSupabase } from "@/hooks/useSupabaseClient";
import Image from "next/image";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getBalanceAfterFromPayload = (
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
): number | null => {
  // For INSERT/UPDATE, Supabase puts the row in payload.new (as a generic record)
  const next = payload.new;

  if (!isRecord(next)) return null;

  const balanceAfter = next["balance_after"];

  return typeof balanceAfter === "number" ? balanceAfter : null;
};

const Navbar = () => {
  const { supabase } = useSupabase();
  const { maintenance, isFunModeOn, toggleFunMode } = useAppContext();
  const { user, isLoaded } = useUser();
  const [tokens, setTokens] = useState<number | null>(null);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [hasSubscription, setHasSubscription] = useState(false)

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      return
    }

    try {

      const response = await fetch("/api/stripe/subscription/get")
      const data = await response.json()

      if (response.ok) {
        setHasSubscription(data.hasSubscription)
      }
    } catch (err) {
      console.error("Error fetching subscription:", err)
    }
  }, [isLoaded, user?.id]);


  const fetchTokens = useCallback(async () => {
    if (!isLoaded || !user?.id) {
      setTokens(null);
      setLoadingTokens(false);
      return;
    }

    setLoadingTokens(true);
    try {
      const response = await fetch("/api/tokens/balance");

      if (!response.ok) {
        console.error("Error fetching tokens:", response.statusText);
        setTokens(null);
        return;
      }

      const data: { success: boolean; balance?: number; error?: string } =
        await response.json();

      if (data.success) {
        setTokens(data.balance ?? 0);
      } else {
        console.error("Error fetching tokens:", data.error);
        setTokens(null);
      }
    } catch (error) {
      console.error("Error fetching tokens:", error);
      setTokens(null);
    } finally {
      setLoadingTokens(false);
    }
  }, [isLoaded, user?.id]);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);
  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  useEffect(() => {
    if (!isLoaded || !user?.id) return;

    const channel = supabase
      .channel("token-transactions")
      .on(
        "postgres_changes",
        {
          event: "*", // INSERT, UPDATE, DELETE
          schema: "public",
          table: "token_transactions",
          filter: `user_id=eq.${user.id}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const nextBalance = getBalanceAfterFromPayload(payload);

          if (typeof nextBalance === "number") {
            setTokens(nextBalance);
          } else {
            fetchTokens();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, isLoaded, user?.id, fetchTokens]);

  return (
    <>
      {maintenance.isMaintenance && (
        <div className="w-full bg-[#503d08] border-b border-yellow-300 text-white py-2.5 px-4 flex items-center gap-2 text-sm font-medium shadow-[0_1px_2px_rgba(0,0,0,0.08)]">
          <span className="inline-block w-2 h-2 rounded-full bg-yellow-600 animate-pulse" />
          <span>{maintenance.maintenanceMessage}</span>
        </div>
      )}
      <header className="w-full border-b border-white/10 bg-white/70 backdrop-blur-xl transition-all duration-300 dark:border-white/5 dark:bg-[#0f0f12]/70">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-4 py-2 sm:px-6">
          <Link
            href="/"
            className="group flex items-center gap-3 rounded-full border border-transparent px-1 py-1 text-gray-900 transition-colors duration-300 hover:border-white/20 dark:text-white"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl  text-base font-semibold uppercase tracking-tight text-white shadow-lg shadow-[#6c47ff]/30 transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105">
              <Image alt="Logo" src="/BR.svg" width={44} height={44} />
            </span>
            <span
              className="flex flex-col leading-tight"
              style={{ fontFamily: "Raleway, 'Inter', sans-serif" }}
            >
              <span className="text-lg font-semibold tracking-tight text-gray-900 transition-colors duration-300 group-hover:text-[#6c47ff] dark:text-white dark:group-hover:text-[#b8a4ff]">
                BR
                <span className="bg-gradient-to-r from-[#108fea]  to-[#108fea] bg-clip-text text-transparent">
                  -MAX
                </span>
              </span>
              <span className="hidden text-[11px] font-medium uppercase tracking-[0.4em] text-gray-500 dark:text-gray-400 sm:block">
                iMessage Video Studio
              </span>
            </span>
          </Link>

          <div className="ml-auto flex flex-1 items-center justify-end gap-3 sm:gap-4">
            <SignedIn>
              <div className="flex flex-wrap flex-col items-center gap-3 relative">
                <div className={`flex items-start gap-2 rounded-full border border-[#6c47ff]/20 ${hasSubscription && "mb-5"} bg-gradient-to-r from-[#6c47ff]/10 to-[#8b5cf6]/10 px-4 py-2 shadow-sm shadow-[#6c47ff]/10 backdrop-blur-sm transition-all duration-300 hover:shadow-[#6c47ff]/25 dark:border-[#6c47ff]/30 dark:from-[#6c47ff]/15 dark:to-[#8b5cf6]/15`}>
                  <Coins className="mt-1 h-4 w-4 text-[#6c47ff] dark:text-[#8b5cf6]" />
                  <div className="flex flex-col">
                    {loadingTokens ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-[#6c47ff] dark:text-[#8b5cf6]" />
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                          Loading...
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm font-semibold text-gray-800 text-center dark:text-gray-100">
                        <span className="text-[#6c47ff] dark:text-[#8b5cf6]">
                          {tokens !== null ? (
                            <CountUp end={tokens} duration={1500} delay={1400} />
                          ) : (
                            ","
                          )}
                        </span>
                        <span className="ml-1 text-xs font-normal text-gray-500 dark:text-gray-400">
                          tokens
                        </span>
                      </span>
                    )}
                  </div>
                </div>
                

                {hasSubscription && (
                  <Link href="/subscription" className="text-xs hover:underline transition-all duration-300 absolute bottom-0">
                    Manage subscriptions
                  </Link>
                )}
              </div>

            </SignedIn>

            <button
              onClick={toggleFunMode}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-300
                ${
                  isFunModeOn
                    ? "bg-gradient-to-r from-pink-500 to-yellow-400 text-white shadow-lg shadow-pink-400/30 hover:scale-[1.05]"
                    : "border border-gray-200 bg-white/60 text-gray-700 hover:border-gray-300 hover:bg-white dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-200 dark:hover:border-gray-600"
                }`}
            >
              {isFunModeOn ? (
                <>
                  <Sparkles className="h-4 w-4" />
                  Fun Mode ON
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4" />
                  Fun Mode OFF
                </>
              )}
            </button>

            <SignedOut>
              <div className="flex items-center gap-2">
                <SignInButton mode="modal">
                  <button className="h-9 rounded-full bg-[#6c47ff] px-4 text-sm font-medium text-white transition hover:bg-[#5a3ce0]">
                    Sign In
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="h-9 rounded-full border border-[#6c47ff] bg-white px-4 text-sm font-medium text-[#6c47ff] transition hover:bg-[#f4f0ff]">
                    Sign Up
                  </button>
                </SignUpButton>
              </div>
            </SignedOut>

            <SignedIn>
              <UserButton
                appearance={{
                  elements: {
                    userButtonAvatarBox: {
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      border: "2px solid #6c47ff",
                    },
                    userButtonTrigger: {
                      padding: "4px",
                      backgroundColor: "#f4f0ff",
                      borderRadius: "9999px",
                      transition: "all 0.2s ease",
                      "&:hover": {
                        backgroundColor: "#e9e3ff",
                      },
                    },
                  },
                }}
              />
            </SignedIn>
          </div>
        </div>
      </header>
    </>
  );
};

export default Navbar;
