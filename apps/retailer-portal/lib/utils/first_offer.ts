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

export type FirstOfferFields = {
  benefitText: string;   // e.g. "10% off", "Free coffee" — large display value
  headline: string;      // e.g. "10% off every visit" — full offer title
  description: string;   // terms / description, required, min 20 chars → offers.description
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
  benefitText: '',
  headline: '',
  description: '',
  offerType: 'percentage_discount',
  redemptionRule: 'unlimited',
  startDate: '',
  endDate: '',
  totalCap: '',
};
