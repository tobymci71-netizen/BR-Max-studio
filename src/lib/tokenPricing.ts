export const TOKEN_PRICING_CONFIG = {
  usdPer100: 0.7,
  discountTiers: [
    { minTokens: 2000, percentOff: 10 },
    { minTokens: 3000, percentOff: 15 },
  ],
};

export interface DiscountTier {
  minTokens: number;
  percentOff: number;
}

export interface TokenPriceBreakdown {
  tokens: number;
  baseCost: number;
  finalCost: number;
  discountPercent: number;
  discountAmount: number;
  usdPer100: number;
  effectiveUsdPer100: number;
  tier?: DiscountTier;
}

export function getDiscountTier(tokenAmount: number): DiscountTier | undefined {
  const tiers = TOKEN_PRICING_CONFIG.discountTiers.slice().sort((a, b) => a.minTokens - b.minTokens);
  let selected: DiscountTier | undefined;
  for (const tier of tiers) {
    if (tokenAmount >= tier.minTokens) {
      selected = tier;
    } else {
      break;
    }
  }
  return selected;
}

export function calculateTokenPrice(tokenAmount: number): TokenPriceBreakdown {
  const normalizedTokens = Math.max(0, Math.floor(tokenAmount));
  const usdPerToken = TOKEN_PRICING_CONFIG.usdPer100 / 100;
  const tier = getDiscountTier(normalizedTokens);
  const discountPercent = tier?.percentOff ?? 0;
  const baseCost = normalizedTokens * usdPerToken;
  const discountMultiplier = (100 - discountPercent) / 100;
  const finalCostRaw = normalizedTokens === 0 ? 0 : baseCost * discountMultiplier;
  const finalCost = Number(finalCostRaw.toFixed(2));
  const effectiveUsdPer100 = normalizedTokens === 0
    ? TOKEN_PRICING_CONFIG.usdPer100
    : Number(((finalCost / normalizedTokens) * 100).toFixed(4));

  return {
    tokens: normalizedTokens,
    baseCost: Number(baseCost.toFixed(2)),
    finalCost,
    discountPercent,
    discountAmount: Number((baseCost - finalCost).toFixed(2)),
    usdPer100: TOKEN_PRICING_CONFIG.usdPer100,
    effectiveUsdPer100,
    tier,
  };
}
