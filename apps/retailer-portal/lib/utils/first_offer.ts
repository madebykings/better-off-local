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

// Types shown in the standard offer creation form.
// Loyalty and referral programmes are created via their dedicated pages.
export const STANDARD_OFFER_TYPES: ReadonlyArray<OfferType> = [
  'percentage_discount',
  'fixed_discount',
  'free_item',
  'buy_one_get_one',
  'meal_deal',
  'other',
];

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

// ---------------------------------------------------------------------------
// Type-specific offer metadata (display fields — not enforcement)
// ---------------------------------------------------------------------------

export type OfferMetaFields = {
  appliesTo?: string;          // percentage_discount: "all drinks"
  minSpend?: string;           // percentage_discount + fixed_discount: "20"
  freeItemName?: string;       // free_item: "Large Coffee"
  qualifyingPurchase?: string; // free_item: "any breakfast"
  buyItem?: string;            // buy_one_get_one: "any main course"
  receiveItem?: string;        // buy_one_get_one: "second of equal or lesser value"
  bundlePrice?: string;        // meal_deal: "9.99"
  includedItems?: string[];    // meal_deal: ["Burger", "Fries", "Drink"]
};

export const EMPTY_OFFER_META: OfferMetaFields = {
  appliesTo: '',
  minSpend: '',
  freeItemName: '',
  qualifyingPurchase: '',
  buyItem: '',
  receiveItem: '',
  bundlePrice: '',
  includedItems: [],
};

/** Returns true for types that support type-specific display metadata. */
export function needsOfferMeta(offerType: OfferType): boolean {
  return (
    offerType === 'percentage_discount' ||
    offerType === 'fixed_discount' ||
    offerType === 'free_item' ||
    offerType === 'buy_one_get_one' ||
    offerType === 'meal_deal'
  );
}

/** Auto-derives estimated saving in pence. Only derivable for fixed_discount. */
export function autoDeriveSavingPence(offerType: OfferType, discountValue: string): number | null {
  if (offerType === 'fixed_discount') {
    const v = parseFloat(discountValue);
    if (!isNaN(v) && v > 0) return Math.round(v * 100);
  }
  return null;
}

/** Builds a short summary string from structured offer meta for the mobile card. */
export function buildShortSummary(
  offerType: OfferType,
  meta: OfferMetaFields,
  discountValue: string,
): string | null {
  switch (offerType) {
    case 'percentage_discount': {
      const v = discountValue.trim();
      if (!v) return null;
      let s = `${v}% off`;
      if (meta.appliesTo?.trim()) s += ` ${meta.appliesTo.trim()}`;
      if (meta.minSpend?.trim()) s += ` — min. spend £${meta.minSpend.trim()}`;
      return s;
    }
    case 'fixed_discount': {
      const v = discountValue.trim();
      if (!v) return null;
      let s = `£${v} off`;
      if (meta.minSpend?.trim()) s += ` when you spend £${meta.minSpend.trim()} or more`;
      return s;
    }
    case 'free_item': {
      const name = meta.freeItemName?.trim();
      if (!name) return null;
      let s = `Free ${name}`;
      if (meta.qualifyingPurchase?.trim()) s += ` with ${meta.qualifyingPurchase.trim().toLowerCase()}`;
      return s;
    }
    case 'buy_one_get_one': {
      const buy = meta.buyItem?.trim();
      const get = meta.receiveItem?.trim();
      if (buy && get) return `Buy ${buy} · get ${get}`;
      return 'Buy one, get one free';
    }
    case 'meal_deal': {
      const price = meta.bundlePrice?.trim();
      const items = (meta.includedItems ?? []).filter((i) => i.trim());
      if (price && items.length) return `Meal deal £${price} · ${items.join(', ')}`;
      if (price) return `Meal deal — £${price}`;
      if (items.length) return `Meal deal: ${items.join(', ')}`;
      return 'Members meal deal';
    }
    case 'loyalty_visits':
      return 'Loyalty stamp card — collect stamps, earn rewards';
    case 'venue_referral':
      return 'Refer a friend and earn rewards';
    default:
      return null;
  }
}

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
