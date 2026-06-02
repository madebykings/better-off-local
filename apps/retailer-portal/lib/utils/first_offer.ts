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
  'other',
] as const;

export type OfferType = (typeof OFFER_TYPES)[number];

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
      return 'BUY ONE GET ONE';
    case 'meal_deal':
      return 'MEAL DEAL';
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
