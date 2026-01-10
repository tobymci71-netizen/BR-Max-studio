type TokenConfig = {
  minTokens: number;
  maxTokens: number;
  baseRateUsd: number;
};

const parseRequiredNumber = (key: string): number => {
  const raw = process.env[key];
  if (raw === undefined) {
    throw new Error(`Missing ${key} environment variable`);
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid number for ${key}`);
  }

  return parsed;
};

export const getTokenConfig = (): TokenConfig => {
  const minTokens = parseRequiredNumber("NEXT_PUBLIC_TOKEN_MIN_TOKENS");
  const maxTokens = parseRequiredNumber("NEXT_PUBLIC_TOKEN_MAX_TOKENS");
  const baseRateUsd = parseRequiredNumber("NEXT_PUBLIC_TOKEN_BASE_RATE_USD");

  if (maxTokens < minTokens) {
    throw new Error("NEXT_PUBLIC_TOKEN_MAX_TOKENS must be greater than or equal to NEXT_PUBLIC_TOKEN_MIN_TOKENS");
  }

  return {
    minTokens,
    maxTokens,
    baseRateUsd,
  };
};

export const tryGetTokenConfig = (): {
  config: TokenConfig | null;
  error?: string;
} => {
  try {
    return { config: getTokenConfig() };
  } catch (error) {
    console.error("Token config error:", error);
    return {
      config: null,
      error: error instanceof Error ? error.message : "Token configuration unavailable",
    };
  }
};
