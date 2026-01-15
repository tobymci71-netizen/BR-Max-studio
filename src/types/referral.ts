/**
 * Individual payment record for a referred user's subscription
 */
export interface ReferralPayment {
  userId: string;
  subscriptionId: string;
  subscriptionAmount: number;
  paymentPercentage: number;
  amountToPay: number;
  isPaid: boolean;
  paidAt: string | null; // ISO date string or null
}

/**
 * Referral status type
 */
export type ReferralStatus = "active" | "inactive";

/**
 * Main Referrals table interface
 */
export interface Referral {
  referral_id: string;
  user_id: string;
  referral_code: string;
  referral_link: string;
  commission_percentage: number;
  total_referrals_count: number;
  referred_user_ids: string[]; // Array of user IDs (latest first)
  paid_user_ids: string[]; // Array of user IDs who've been paid
  referral_payments: ReferralPayment[]; // Array of payment objects
  status: ReferralStatus; // active or inactive
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
}

/**
 * Payload for creating a new referral
 */
export interface CreateReferralPayload {
  user_id: string;
  referral_code: string;
  commission_percentage: number;
}

/**
 * Payload for recording a referred subscription
 */
export interface RecordReferredSubscriptionPayload {
  referral_code: string;
  referred_user_id: string;
  subscription_id: string;
  subscription_amount: number;
}
