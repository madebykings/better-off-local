'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const OFFER_TYPES = [
  'percentage_discount',
  'fixed_discount',
  'free_item',
  'other',
] as const;

export type OfferType = (typeof OFFER_TYPES)[number];

export const REDEMPTION_RULES = [
  'unlimited',
  'once_per_member',
  'once_per_day',
  'once_per_week',
  'once_per_month',
] as const;

export type RedemptionRule = (typeof REDEMPTION_RULES)[number];

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

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateFirstOffer(
  fields: FirstOfferFields,
): Partial<Record<keyof FirstOfferFields, string>> {
  const errors: Partial<Record<keyof FirstOfferFields, string>> = {};

  if (!fields.benefitText.trim()) {
    errors.benefitText = 'Please enter the benefit, e.g. "10% off" or "Free coffee".';
  }

  if (!fields.headline.trim()) {
    errors.headline = 'Please enter a headline for the offer.';
  }

  if (!fields.description.trim()) {
    errors.description = 'Please add a description.';
  } else if (fields.description.trim().length < 20) {
    errors.description = 'Description must be at least 20 characters.';
  }

  if (!OFFER_TYPES.includes(fields.offerType)) {
    errors.offerType = 'Please select an offer type.';
  }

  if (fields.startDate && fields.endDate && fields.endDate <= fields.startDate) {
    errors.endDate = 'End date must be after the start date.';
  }

  if (fields.totalCap.trim()) {
    const cap = parseInt(fields.totalCap, 10);
    if (isNaN(cap) || cap < 1 || String(Math.floor(cap)) !== fields.totalCap.trim()) {
      errors.totalCap = 'Redemption cap must be a positive whole number.';
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getAuthUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect('/sign-in');
  return user.id;
}

async function getRetailerId(userId: string): Promise<string | null> {
  const service = createServiceClient();
  const { data } = await service
    .from('retailer_users')
    .select('retailer_id')
    .eq('profile_id', userId)
    .maybeSingle();
  return data?.retailer_id ?? null;
}

// ---------------------------------------------------------------------------
// Redemption rule ↔ offer_rules columns
// ---------------------------------------------------------------------------

type RuleColumns = {
  max_redemptions_per_user: number | null;
  max_redemptions_per_day: number | null;
  cooldown_hours: number | null;
};

export function ruleToColumns(rule: RedemptionRule): RuleColumns {
  switch (rule) {
    case 'unlimited':
      return { max_redemptions_per_user: null, max_redemptions_per_day: null, cooldown_hours: null };
    case 'once_per_member':
      return { max_redemptions_per_user: 1, max_redemptions_per_day: null, cooldown_hours: null };
    case 'once_per_day':
      return { max_redemptions_per_user: null, max_redemptions_per_day: 1, cooldown_hours: null };
    case 'once_per_week':
      return { max_redemptions_per_user: null, max_redemptions_per_day: null, cooldown_hours: 168 };
    case 'once_per_month':
      return { max_redemptions_per_user: null, max_redemptions_per_day: null, cooldown_hours: 720 };
  }
}

export function ruleFromColumns(cols: RuleColumns): RedemptionRule {
  if (cols.max_redemptions_per_user === 1) return 'once_per_member';
  if (cols.max_redemptions_per_day === 1) return 'once_per_day';
  if (cols.cooldown_hours === 168) return 'once_per_week';
  if (cols.cooldown_hours === 720) return 'once_per_month';
  return 'unlimited';
}

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------

/**
 * Persists the retailer's first onboarding offer.
 *
 * Upserts an offer row tagged with onboarding_source = 'first-offer' and an
 * offer_rules row (one per offer, ON CONFLICT offer_id DO UPDATE). Status is
 * always 'draft' — the offer goes live only after admin approval.
 *
 * Advances onboarding_step to 'preview' only if currently on 'first-offer'.
 */
export async function saveFirstOffer(
  fields: FirstOfferFields,
): Promise<FirstOfferActionResult | null> {
  const fieldErrors = validateFirstOffer(fields);
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const userId = await getAuthUserId();
  const retailerId = await getRetailerId(userId);

  if (!retailerId) {
    return { error: 'No retailer record found. Please complete the previous steps.' };
  }

  const service = createServiceClient();

  // Read current step before mutating.
  const { data: retailer } = await service
    .from('retailers')
    .select('onboarding_step')
    .eq('id', retailerId)
    .single();

  // Find existing onboarding offer for pre-fill / update.
  const { data: existingOffer } = await service
    .from('offers')
    .select('id')
    .eq('retailer_id', retailerId)
    .eq('onboarding_source', 'first-offer')
    .maybeSingle();

  const offerPayload = {
    retailer_id: retailerId,
    title: fields.headline.trim(),
    value_text: fields.benefitText.trim(),
    description: fields.description.trim(),
    offer_type: fields.offerType,
    start_at: fields.startDate ? new Date(fields.startDate).toISOString() : null,
    end_at: fields.endDate ? new Date(fields.endDate).toISOString() : null,
    status: 'draft' as const,
    onboarding_source: 'first-offer',
    updated_at: new Date().toISOString(),
  };

  let offerId: string;

  if (existingOffer?.id) {
    const { error: updateError } = await service
      .from('offers')
      .update(offerPayload)
      .eq('id', existingOffer.id);

    if (updateError) {
      console.error('[saveFirstOffer] offer update error:', updateError.message);
      return { error: 'Failed to save your offer. Please try again.' };
    }

    offerId = existingOffer.id;
  } else {
    const { data: newOffer, error: insertError } = await service
      .from('offers')
      .insert({ ...offerPayload, created_by_profile_id: userId })
      .select('id')
      .single();

    if (insertError || !newOffer) {
      console.error('[saveFirstOffer] offer insert error:', insertError?.message);
      return { error: 'Failed to save your offer. Please try again.' };
    }

    offerId = newOffer.id;
  }

  // Upsert offer_rules (unique constraint on offer_id).
  const ruleColumns = ruleToColumns(fields.redemptionRule);
  const { error: rulesError } = await service
    .from('offer_rules')
    .upsert(
      {
        offer_id: offerId,
        max_redemptions_total: fields.totalCap.trim() ? parseInt(fields.totalCap, 10) : null,
        ...ruleColumns,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'offer_id' },
    );

  if (rulesError) {
    console.error('[saveFirstOffer] rules upsert error:', rulesError.message);
    return { error: 'Failed to save redemption rules. Please try again.' };
  }

  // ── Advance step ─────────────────────────────────────────────────────────
  if (retailer?.onboarding_step === 'first-offer') {
    const { error: stepError } = await service
      .from('retailers')
      .update({ onboarding_step: 'preview', updated_at: new Date().toISOString() })
      .eq('id', retailerId);

    if (stepError) {
      console.error('[saveFirstOffer] step advance error:', stepError.message);
      return {
        error: 'Your offer was saved, but we could not advance to the next step. Please try again.',
      };
    }
  }

  return null;
}
