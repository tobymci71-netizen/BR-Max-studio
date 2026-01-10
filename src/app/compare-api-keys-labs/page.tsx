"use client";

import { FormEvent, useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

type ApiKeyResult = {
  keyPreview: string;
  name?: string;
  tier?: string;
  characterCount?: number;
  characterLimit?: number;
  nextReset?: number;
  error?: string;
};

const ELEVEN_LABS_BASE = "https://api.elevenlabs.io/v1";

const formatTimestamp = (unixSeconds?: number) => {
  if (unixSeconds == null) return "N/A";
  const date = new Date(unixSeconds * 1000);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatTimeRemaining = (unixSeconds?: number, currentTimeMs?: number) => {
  if (unixSeconds == null) return "N/A";
  const now = Math.floor((currentTimeMs ?? Date.now()) / 1000);
  const diff = unixSeconds - now;
  
  if (diff <= 0) return "Reset";
  
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;
  
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  
  return parts.join(" ");
};

const maskApiKey = (value: string) => {
  if (!value) return "";
  if (value.length <= 12) {
    return value;
  }
  return `...${value.slice(-4)}`;
};

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
};

const fetchWithAuth = async (url: string, key: string) => {
  const response = await fetch(url, {
    headers: {
      "xi-api-key": key,
    },
    cache: "no-store",
  });

  const parsedBody = await response.json().catch(() => null);

  if (!response.ok) {
    let errorMessage = response.statusText || "Request failed";
    if (parsedBody && typeof parsedBody === "object") {
      errorMessage =
        parsedBody.message ??
        parsedBody.detail ??
        (typeof parsedBody.error === "string" ? parsedBody.error : errorMessage);
    }
    throw new Error(errorMessage);
  }

  return parsedBody;
};

export default function CompareApiKeysLabsPage() {
  const [keysInput, setKeysInput] = useState("");
  const [results, setResults] = useState<ApiKeyResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [globalError, setGlobalError] = useState("");
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleCheckKeys = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedKeys = Array.from(
      new Set(
        keysInput
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
      )
    );

    if (parsedKeys.length === 0) {
      setGlobalError("Paste at least one Eleven Labs API key.");
      setResults([]);
      return;
    }

    setGlobalError("");
    setResults([]);
    setIsLoading(true);

    try {
      const fetchedResults = await Promise.all(
        parsedKeys.map(async (key) => {
          try {
            const [userData, subscriptionData] = await Promise.all([
              fetchWithAuth(`${ELEVEN_LABS_BASE}/user`, key),
              fetchWithAuth(`${ELEVEN_LABS_BASE}/user/subscription`, key),
            ]);

            const characterCount =
              toNumber(subscriptionData?.character_count) ??
              toNumber(userData?.character_count);

            const characterLimit = toNumber(subscriptionData?.character_limit);
            const tier = subscriptionData?.tier || userData?.tier || "N/A";

            return {
              keyPreview: maskApiKey(key),
              tier: typeof tier === "string" ? tier : "N/A",
              characterCount,
              characterLimit,
              nextReset: toNumber(
                subscriptionData?.next_character_count_reset_unix
              ),
            };
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Unable to fetch data";
            return {
              keyPreview: maskApiKey(key),
              error: message,
            };
          }
        })
      );

      setResults(fetchedResults);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#050507] to-[#0b0b0f] py-12">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-[#050507]/80 backdrop-blur-2xl">
          <p className="text-xs uppercase tracking-[0.4em] text-white/50">
            Eleven Labs helper
          </p>
          <h1 className="mt-3 text-3xl font-light text-white sm:text-4xl">
            Compare API keys quickly
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/70">
            Paste every API key on its own line. We will call Eleven Labs&apos;
            <code className="rounded px-1 text-xs text-white">/user</code> and
            <code className="ml-1 rounded px-1 text-xs text-white">
              /subscription
            </code>
            for each key and show the owner, character usage, and next reset in a
            human-friendly table.
          </p>
        </div>

        <form
          onSubmit={handleCheckKeys}
          className="rounded-3xl border border-white/5 bg-gradient-to-br from-white/5 via-white/5 to-transparent p-6 shadow-lg shadow-[#050507]/80 backdrop-blur-2xl"
        >
          <label htmlFor="apiKeys" className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
            API keys
          </label>
          <textarea
            id="apiKeys"
            value={keysInput}
            onChange={(event) => setKeysInput(event.target.value)}
            rows={6}
            placeholder="sk-abc123... (each line is a key)"
            className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-white/40 focus:ring-1 focus:ring-white/30"
          />
          {globalError && (
            <p className="mt-2 text-xs text-rose-400">{globalError}</p>
          )}
          <div className="mt-4 flex items-center justify-between gap-4">
            <p className="text-xs text-white/60">
              Each API key stays local in your browser.
            </p>
            <button
              type="submit"
              className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#6c47ff] to-[#7d5bff] px-6 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoading}
            >
              {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking...
                  </>
              ) : (
                "Compare keys"
              )}
            </button>
          </div>
        </form>

        <div className="rounded-3xl border border-white/5 bg-white/5 p-6 shadow-2xl shadow-[#050507]/70 backdrop-blur-2xl">
          {results.length === 0 ? (
            <p className="text-sm text-white/60">
              Paste keys above and hit "Compare keys" to see each owner&apos;s
              usage and limits.
            </p>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-white/60">
                Showing {results.length} API key{results.length > 1 ? "s" : ""}.
              </p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-[13px] text-white/80">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-[0.3em] text-white/60">
                      <th className="pb-3 pr-4 font-semibold tracking-normal">Key</th>
                      <th className="pb-3 pr-4 font-semibold tracking-normal">
                        Tier
                      </th>
                      <th className="pb-3 pr-4 font-semibold tracking-normal">
                        Remaining
                      </th>
                      <th className="pb-3 pr-4 font-semibold tracking-normal">
                        Limit
                      </th>
                      <th className="pb-3 pr-4 font-semibold tracking-normal">Next reset</th>
                      <th className="pb-3 font-semibold tracking-normal">Time left</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {results.map((item, index) => {
                      const resetLabel = formatTimestamp(item.nextReset);
                      const timeLeft = formatTimeRemaining(item.nextReset, currentTime);
                      const charLimit =
                        item.characterLimit !== undefined
                          ? item.characterLimit.toLocaleString()
                          : "N/A";
                      
                      let remainingDisplay = "N/A";
                      let remainingColor = "";
                      
                      if (!item.error && item.characterLimit !== undefined && item.characterCount !== undefined) {
                        const remaining = item.characterLimit - item.characterCount;
                        remainingDisplay = remaining.toLocaleString();
                        
                        if (remaining < 2000) {
                          remainingColor = "text-red-400";
                        } else if (remaining < 6000) {
                          remainingColor = "text-yellow-400";
                        } else {
                          remainingColor = "text-green-400";
                        }
                      }

                      return (
                        <tr key={`${item.keyPreview}-${index}`} className="text-sm">
                          <td className="py-4 pr-4 font-semibold">{item.keyPreview}</td>
                          <td className="py-4 pr-4">
                            {item.error ? "N/A" : (item.tier || "N/A")}
                          </td>
                          <td className={`py-4 pr-4 font-semibold ${remainingColor}`}>
                            {item.error ? "N/A" : remainingDisplay}
                          </td>
                          <td className="py-4 pr-4">
                            {item.error ? "N/A" : charLimit}
                          </td>
                          <td className="py-4 pr-4">{item.error ? "N/A" : resetLabel}</td>
                          <td className="py-4 font-mono text-xs">{item.error ? "N/A" : timeLeft}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
