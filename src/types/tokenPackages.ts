export interface TokenPackage {
  id: string;
  created_at: string;
  name: string;
  tokens: number;
  priceUSD: number;
  features: string[];
  popular: boolean;
  stripe_price_id?: string;
}
