const parseEnvNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const MIN_TOKENS = parseEnvNumber(
  process.env.NEXT_PUBLIC_TOKEN_MIN_TOKENS,
  1,
);

const MAX_TOKENS = Math.max(
  MIN_TOKENS,
  parseEnvNumber(process.env.NEXT_PUBLIC_TOKEN_MAX_TOKENS, 100000),
);

const BASE_RATE_USD = parseEnvNumber(
  process.env.NEXT_PUBLIC_TOKEN_BASE_RATE_USD,
  0.001,
);

const TOKEN_STEP = Math.max(
  1,
  parseEnvNumber(process.env.NEXT_PUBLIC_TOKEN_STEP, 100),
);

const TIMEOUT_MS = 5000;

const PAYPAL_CURRENCIES = new Set([
  "USD",
  "AUD",
  "DKK",
  "CHF",
  "CZK",
  "CAD",
  "EUR",
  "GBP",
  "HKD",
  "HUF",
  "ILS",
  "JPY",
  "MXN",
  "NOK",
  "NZD",
  "PHP",
  "PLN",
  "RUB",
  "SEK",
  "SGD",
  "THB",
  "TWD",
]);

export {
  parseEnvNumber,
  MIN_TOKENS,
  MAX_TOKENS,
  BASE_RATE_USD,
  TOKEN_STEP,
  TIMEOUT_MS,
  PAYPAL_CURRENCIES,
};
