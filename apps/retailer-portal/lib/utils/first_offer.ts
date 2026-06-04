// ---------------------------------------------------------------------------
// First offer types and constants
//
// Pure data — no 'use server' directive.
// ---------------------------------------------------------------------------

import type { RedemptionRule } from './redemption_rules';

export const OFFER_TYPES = [
  'percentage_discount',
  'fixed_discount',
  'free_item',
  'buy_one_get_one',
  'meal_deal',
  'loyalty_visits',
  'venue_referral',
  'other',
] as const;

export type OfferType = (typeof OFFER_TYPES)[number];

export const LOYALTY_REWARD_TYPES = ['free_item', 'percentage_discount', 'fixed_discount'] as const;
export type LoyaltyRewardType = (typeof LOYALTY_REWARD_TYPES)[number];

export type LoyaltyConfigFields = {
  stampsRequired: string;       // '2'–'20'
  rewardDescription: string;   // "Free flat white"
  rewardType: LoyaltyRewardType;
  rewardValueText: string;      // "£3.50 value", "50% off" — displayed on completed card
  minHoursBetweenStamps: string; // '0', '1', '20', '24', …
};

export const EMPTY_LOYALTY_CONFIG: LoyaltyConfigFields = {
  stampsRequired: '8',
  rewardDescription: '',
  rewardType: 'free_item',
  rewardValueText: '',
  minHoursBetweenStamps: '0',
};

/**
 * Derives the card badge text from offer type + optional discount value.
 * This is the single source of truth for value_text stored in the DB.
 */
export function computeValueText(offerType: OfferType, discountValue: string): string {
  const v = discountValue.trim();
  switch (offerType) {
    case 'percentage_discount':
      return v ? `${v}% OFF` : '';
    case 'fixed_discount':
      return v ? `£${v} OFF` : '';
    case 'free_item':
      return 'FREE ITEM';
    case 'buy_one_get_one':
      return 'BOGOF';
    case 'meal_deal':
      return 'MEAL DEAL';
    case 'loyalty_visits':
      return 'COLLECT STAMPS';
    case 'venue_referral':
      return 'REFER & EARN';
    case 'other':
      return 'SPECIAL DEAL';
    default:
      return '';
  }
}

/** Returns true for offer types that require a numeric discount value. */
export function needsDiscountValue(offerType: OfferType): boolean {
  return offerType === 'percentage_discount' || offerType === 'fixed_discount';
}

/** Returns true for the loyalty_visits offer type which requires stamp-card config. */
export function needsLoyaltyConfig(offerType: OfferType): boolean {
  return offerType === 'loyalty_visits';
}

/** Returns true for the venue_referral offer type which requires referral campaign config. */
export function needsVenueReferralConfig(offerType: OfferType): boolean {
  return offerType === 'venue_referral';
}

export const VENUE_REFERRAL_MAX_REWARD_OPTIONS = [
  { value: '',   label: 'Unlimited — no cap on rewards per member' },
  { value: '1',  label: '1 reward per member' },
  { value: '3',  label: '3 rewards per member' },
  { value: '5',  label: '5 rewards per member' },
  { value: '10', label: '10 rewards per member' },
] as const;

export type VenueReferralConfigFields = {
  rewardTitle: string;              // e.g. "Free haircut"
  rewardDescription: string;        // optional longer description
  friendRewardEnabled: boolean;
  friendRewardTitle: string;
  friendRewardDescription: string;
  maxRewardsPerReferrer: string;    // '' = unlimited, or '1'/'3'/'5'/'10'/custom integer string
};

export const EMPTY_VENUE_REFERRAL_CONFIG: VenueReferralConfigFields = {
  rewardTitle: '',
  rewardDescription: '',
  friendRewardEnabled: false,
  friendRewardTitle: '',
  friendRewardDescription: '',
  maxRewardsPerReferrer: '',
};

/** Label for the discount value input based on offer type. */
export function discountValueLabel(offerType: OfferType): string {
  return offerType === 'percentage_discount' ? 'Discount percentage' : 'Discount amount (£)';
}

/** Placeholder for the discount value input based on offer type. */
export function discountValuePlaceholder(offerType: OfferType): string {
  return offerType === 'percentage_discount' ? 'e.g. 10 (for 10% off)' : 'e.g. 5 (for £5 off)';
}

export type FirstOfferFields = {
  discountValue: string; // numeric string, used for percentage/fixed types
  headline: string;      // full offer title → offers.title
  description: string;   // terms / description → offers.description
  offerType: OfferType;
  redemptionRule: RedemptionRule;
  startDate: string;     // YYYY-MM-DD or ''
  endDate: string;       // YYYY-MM-DD or ''
  totalCap: string;      // positive integer string or ''
};

export type FirstOfferActionResult = {
  error?: string;
  fieldErrors?: Partial<Record<keyof FirstOfferFields, string>>;
};

export const EMPTY_OFFER: FirstOfferFields = {
  discountValue: '',
  headline: '',
  description: '',
  offerType: 'percentage_discount',
  redemptionRule: 'unlimited',
  startDate: '',
  endDate: '',
  totalCap: '',
};
