'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import {
  type RedemptionRule,
  type RuleColumns,
  ruleToColumns,
} from '@/lib/utils/redemption_rules';
import {
  type OfferType,
  type FirstOfferFields,
  type FirstOfferActionResult,
  OFFER_TYPES,
  computeValueText,
  needsDiscountValue,
} from '@/lib/utils/first_offer';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateFirstOffer(
  fields: FirstOfferFields,
): Partial<Record<keyof FirstOfferFields, string>> {
  const errors: Partial<Record<keyof FirstOfferFields, string>> = {};

  if (needsDiscountValue(fields.offerType) && !fields.discountValue.trim()) {
    errors.discountValue = 'Please enter the discount value (e.g. 10 for 10% or 5 for £5).';
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
    value_text: computeValueText(fields.offerType, fields.discountValue),
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
  const ruleColumns: RuleColumns = ruleToColumns(fields.redemptionRule);
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
