import { supabaseAdmin } from "@/lib/supabaseAdmin";

const CACHE_TABLE = "exchange_rate_cache";
const CACHE_KEY = "usd_rates";
const CACHE_TTL_MS = 60 * 60 * 1000;

type ExchangeApiResponse = {
  result: string;
  conversion_rates?: Record<string, number>;
  ["error-type"]?: string;
};

const normalizeCurrency = (currency: string) => currency.trim().toUpperCase();

export async function getUsdExchangeRate(targetCurrency: string): Promise<number> {
  const currency = normalizeCurrency(targetCurrency);
  if (currency === "USD") return 1;

  const now = Date.now();
  const { data: cachedRow, error: cacheError } = await supabaseAdmin
    .from(CACHE_TABLE)
    .select("rates, cached_at")
    .eq("id", CACHE_KEY)
    .maybeSingle();

  if (cacheError) {
    console.error("Error fetching cached exchange rate:", cacheError);
  } else if (cachedRow?.rates && cachedRow.cached_at) {
    const cachedAt = new Date(cachedRow.cached_at).getTime();
    if (!Number.isNaN(cachedAt) && now - cachedAt < CACHE_TTL_MS) {
      const cachedValue = cachedRow.rates[currency];
      if (typeof cachedValue === "number" && Number.isFinite(cachedValue)) {
        return cachedValue;
      }
    }
  }

  const rates = await fetchAndCacheRates();
  const requestedRate = rates[currency];
  if (typeof requestedRate !== "number" || !Number.isFinite(requestedRate)) {
    throw new Error(`No rate available for currency ${currency}`);
  }

  return requestedRate;
}

async function fetchAndCacheRates(): Promise<Record<string, number>> {
  const apiKey = process.env.EXCHANGE_RATE_API_KEY;
  if (!apiKey) {
    throw new Error("EXCHANGE_RATE_API_KEY missing");
  }

  const url = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`;
  const response = await fetch(url);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Exchange rate API responded ${response.status}: ${body}`);
  }

  const data = (await response.json()) as ExchangeApiResponse;
  if (data.result !== "success") {
    const reason = data["error-type"] || "unknown";
    throw new Error(`Exchange rate API error: ${reason}`);
  }

  const rawRates = data.conversion_rates;
  if (!rawRates || typeof rawRates !== "object") {
    throw new Error("Exchange rate API returned an unexpected payload");
  }

  const sanitizedRates: Record<string, number> = {};
  for (const [code, value] of Object.entries(rawRates)) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      sanitizedRates[code.toUpperCase()] = parsed;
    }
  }

  const { error: upsertError } = await supabaseAdmin.from(CACHE_TABLE).upsert(
    {
      id: CACHE_KEY,
      rates: sanitizedRates,
      cached_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (upsertError) {
    console.error("Failed to cache exchange rates:", upsertError);
  }

  return sanitizedRates;
}
