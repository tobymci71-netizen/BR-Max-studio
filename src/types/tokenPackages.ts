export interface TokenPackage {
  id: string;
  created_at: string;
  name: string;
  tokens: number;
  priceUSD: number;
  /** First month price in USD; if set, a coupon is applied so the first invoice is this amount. */
  firstMonthPrice?: number | null;
  features: string[];
  popular: boolean;
}
