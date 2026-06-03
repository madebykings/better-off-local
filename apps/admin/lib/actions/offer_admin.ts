'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';
import {
  OFFER_TYPES,
  type OfferType,
  computeValueText,
  needsDiscountValue,
} from '@/lib/utils/first_offer';
import {
  REDEMPTION_RULES,
  type RedemptionRule,
  ruleToColumns,
} from '@/lib/utils/redemption_rules';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AdminOfferFields = {
  offerType:            OfferType;
  discountValue:        string;
  headline:             string;
  shortSummary:         string;
  description:          string;
  termsText:            string;
  redemptionRule:       RedemptionRule;
  startDate:            string;
  endDate:              string;
  totalCap:             string;
  newCustomersOnly:     boolean;
  venueScope:           'all' | 'specific';
  selectedLocationIds:  string[];
  estimatedSavingPence: string;
};

export type AdminOfferResult = {
  error?: string;
  fieldErrors?: Partial<Record<keyof AdminOfferFields, string>>;
};

// ---------------------------------------------------------------------------
// Validation — same rules as the retailer portal
// ---------------------------------------------------------------------------

function validate(f: AdminOfferFields): Partial<Record<keyof AdminOfferFields, string>> {
  const e: Partial<Record<keyof AdminOfferFields, string>> = {};

  if (!OFFER_TYPES.includes(f.offerType)) {
    e.offerType = 'Please select an offer type.';
  }
  if (needsDiscountValue(f.offerType) && !f.discountValue.trim()) {
    e.discountValue = 'Please enter the discount value.';
  }
  if (needsDiscountValue(f.offerType) && f.discountValue.trim()) {
    const n = parseFloat(f.discountValue);
    if (isNaN(n) || n <= 0) e.discountValue = 'Please enter a positive number.';
  }
  if (!f.headline.trim()) {
    e.headline = 'Please enter a headline for the offer.';
  }
  if (!f.description.trim()) {
    e.description = 'Please add a description.';
  } else if (f.description.trim().length < 20) {
    e.description = 'Description must be at least 20 characters.';
  }
  if (f.startDate && f.endDate && f.endDate <= f.startDate) {
    e.endDate = 'End date must be after the start date.';
  }
  if (f.totalCap.trim()) {
    const cap = parseInt(f.totalCap, 10);
    if (isNaN(cap) || cap < 1 || String(Math.floor(cap)) !== f.totalCap.trim()) {
      e.totalCap = 'Redemption cap must be a positive whole number.';
    }
  }
  if (!REDEMPTION_RULES.includes(f.redemptionRule)) {
    e.redemptionRule = 'Please select a redemption rule.';
  }
  return e;
}

// ---------------------------------------------------------------------------
// adminUpdateOffer
// ---------------------------------------------------------------------------

/**
 * Admin variant of updateOffer.
 *
 * Key differences from the retailer-portal action:
 *   - Uses requireAdmin() + service client — no retailer ownership check.
 *   - No material-change detection: admin changes save directly, status
 *     is never changed by this action (status is controlled by moderation).
 *   - Logs offer_admin_updated to admin_actions.
 *   - Supports shortSummary and termsText fields not editable by retailers.
 */
export async function adminUpdateOffer(
  offerId: string,
  fields: AdminOfferFields,
): Promise<AdminOfferResult | null> {
  const fieldErrors = validate(fields);
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const { userId } = await requireAdmin();
  const service = createServiceClient();

  const { data: existing } = await service
    .from('offers')
    .select('id, retailer_id')
    .eq('id', offerId)
    .maybeSingle();

  if (!existing) return { error: 'Offer not found.' };

  const newValueText = computeValueText(fields.offerType, fields.discountValue);

  const { error: updateError } = await service
    .from('offers')
    .update({
      title:                   fields.headline.trim(),
      short_summary:           fields.shortSummary.trim() || null,
      description:             fields.description.trim(),
      terms_text:              fields.termsText.trim() || null,
      offer_type:              fields.offerType,
      value_text:              newValueText,
      venue_scope:             fields.venueScope,
      start_at:                fields.startDate ? new Date(fields.startDate).toISOString() : null,
      end_at:                  fields.endDate   ? new Date(fields.endDate).toISOString()   : null,
      estimated_saving_pence:  fields.estimatedSavingPence.trim()
        ? Math.round(parseFloat(fields.estimatedSavingPence) * 100)
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', offerId);

  if (updateError) {
    console.error('[adminUpdateOffer] update error:', updateError.message);
    return { error: 'Failed to save offer. Please try again.' };
  }

  // Upsert offer_rules.
  const cols = ruleToColumns(fields.redemptionRule);
  await service
    .from('offer_rules')
    .upsert(
      {
        offer_id:                offerId,
        max_redemptions_total:   fields.totalCap.trim() ? parseInt(fields.totalCap, 10) : null,
        new_customers_only:      fields.newCustomersOnly ?? false,
        updated_at:              new Date().toISOString(),
        ...cols,
      },
      { onConflict: 'offer_id' },
    );

  // Replace offer_locations.
  await service.from('offer_locations').delete().eq('offer_id', offerId);
  if (fields.venueScope === 'specific' && fields.selectedLocationIds.length > 0) {
    await service.from('offer_locations').insert(
      fields.selectedLocationIds.map((locId) => ({
        offer_id: offerId,
        retailer_location_id: locId,
      })),
    );
  }

  await service.from('admin_actions').insert({
    admin_profile_id: userId,
    action_type:      'offer_admin_updated',
    target_table:     'offers',
    target_id:        offerId,
    reason:           'Edited by admin',
    metadata_json:    { retailer_id: existing.retailer_id },
  });

  revalidatePath(`/offers/${offerId}`);
  revalidatePath('/offers');
  return null;
}
