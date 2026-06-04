'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { type RuleColumns, ruleToColumns } from '@/lib/utils/redemption_rules';
import {
  type OfferType, OFFER_TYPES, computeValueText, needsDiscountValue,
  needsLoyaltyConfig, needsVenueReferralConfig, needsOfferMeta,
  type LoyaltyConfigFields, EMPTY_LOYALTY_CONFIG,
  type VenueReferralConfigFields,
  type OfferMetaFields, EMPTY_OFFER_META,
  autoDeriveSavingPence, buildShortSummary,
} from '@/lib/utils/first_offer';
import type { RedemptionRule } from '@/lib/utils/redemption_rules';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OfferFields = {
  discountValue: string;   // numeric value for % or £ types — computed into value_text
  headline: string;
  description: string;
  offerType: OfferType;
  redemptionRule: RedemptionRule;
  startDate: string;
  endDate: string;
  totalCap: string;
  newCustomersOnly: boolean;
  venueScope: 'all' | 'specific';
  selectedLocationIds: string[];
  imageUrl: string;            // public URL of the uploaded cover image, or ''
  offerMeta?: OfferMetaFields; // type-specific display fields; null for types that don't use meta
  loyaltyConfig?: LoyaltyConfigFields;
  venueReferralConfig?: VenueReferralConfigFields;
};

export type OfferActionResult = {
  error?: string;
  fieldErrors?: Partial<Record<keyof OfferFields, string>>;
};

export type CreateOfferResult = { offerId: string } | OfferActionResult;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateOffer(fields: OfferFields): Partial<Record<keyof OfferFields, string>> {
  const errors: Partial<Record<keyof OfferFields, string>> = {};
  if (needsDiscountValue(fields.offerType) && !fields.discountValue.trim()) {
    errors.discountValue = 'Please enter the discount value (e.g. 10 for 10% or 5 for £5).';
  }
  if (needsDiscountValue(fields.offerType) && fields.discountValue.trim()) {
    const n = parseFloat(fields.discountValue);
    if (isNaN(n) || n <= 0) {
      errors.discountValue = 'Please enter a positive number.';
    }
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
  if (needsLoyaltyConfig(fields.offerType)) {
    const cfg = fields.loyaltyConfig;
    if (!cfg) {
      errors.offerType = 'Loyalty stamp configuration is required.';
    } else {
      const stamps = parseInt(cfg.stampsRequired, 10);
      if (isNaN(stamps) || stamps < 2 || stamps > 20) {
        errors.loyaltyConfig = 'Stamps required must be between 2 and 20.' as any;
      }
      if (!cfg.rewardDescription.trim()) {
        errors.loyaltyConfig = 'Reward description is required.' as any;
      }
    }
  }
  if (needsVenueReferralConfig(fields.offerType)) {
    const cfg = fields.venueReferralConfig;
    if (!cfg) {
      errors.offerType = 'Referral campaign configuration is required.';
    } else {
      if (!cfg.rewardTitle.trim()) {
        errors.venueReferralConfig = 'Referrer reward title is required.' as any;
      }
      if (cfg.friendRewardEnabled && !cfg.friendRewardTitle.trim()) {
        errors.venueReferralConfig = 'Friend reward title is required when friend reward is enabled.' as any;
      }
      if (cfg.maxRewardsPerReferrer.trim()) {
        const cap = parseInt(cfg.maxRewardsPerReferrer, 10);
        if (isNaN(cap) || cap < 1) {
          errors.venueReferralConfig = 'Reward limit must be a positive whole number.' as any;
        }
      }
    }
  }
  return errors;
}

function buildOfferMetaJson(
  offerType: OfferType,
  meta: OfferMetaFields | undefined,
): Record<string, unknown> | null {
  if (!meta || !needsOfferMeta(offerType)) return null;
  const result: Record<string, unknown> = {};
  if (offerType === 'percentage_discount') {
    if (meta.appliesTo?.trim()) result.applies_to = meta.appliesTo.trim();
    if (meta.minSpend?.trim()) result.min_spend = meta.minSpend.trim();
  } else if (offerType === 'fixed_discount') {
    if (meta.minSpend?.trim()) result.min_spend = meta.minSpend.trim();
  } else if (offerType === 'free_item') {
    if (meta.freeItemName?.trim()) result.free_item_name = meta.freeItemName.trim();
    if (meta.qualifyingPurchase?.trim()) result.qualifying_purchase = meta.qualifyingPurchase.trim();
  } else if (offerType === 'buy_one_get_one') {
    if (meta.buyItem?.trim()) result.buy_item = meta.buyItem.trim();
    if (meta.receiveItem?.trim()) result.receive_item = meta.receiveItem.trim();
  } else if (offerType === 'meal_deal') {
    if (meta.bundlePrice?.trim()) result.bundle_price = meta.bundlePrice.trim();
    const items = (meta.includedItems ?? []).filter((i) => i.trim());
    if (items.length) result.included_items = items;
  }
  return Object.keys(result).length > 0 ? result : null;
}

async function upsertVenueReferralConfig(service: ReturnType<typeof createServiceClient>, offerId: string, cfg: VenueReferralConfigFields): Promise<void> {
  await service.rpc('upsert_venue_referral_config', {
    p_offer_id:                  offerId,
    p_reward_title:              cfg.rewardTitle.trim(),
    p_reward_description:        cfg.rewardDescription.trim() || null,
    p_friend_reward_enabled:     cfg.friendRewardEnabled,
    p_friend_reward_title:       cfg.friendRewardEnabled ? cfg.friendRewardTitle.trim() || null : null,
    p_friend_reward_description: cfg.friendRewardEnabled ? cfg.friendRewardDescription.trim() || null : null,
    p_max_rewards_per_referrer:  cfg.maxRewardsPerReferrer.trim()
      ? parseInt(cfg.maxRewardsPerReferrer, 10)
      : null,
  });
}

async function upsertLoyaltyConfig(service: ReturnType<typeof createServiceClient>, offerId: string, cfg: LoyaltyConfigFields): Promise<void> {
  await service.from('offer_loyalty_config').upsert({
    offer_id: offerId,
    stamps_required: parseInt(cfg.stampsRequired, 10),
    reward_description: cfg.rewardDescription.trim(),
    reward_type: cfg.rewardType,
    reward_value_text: cfg.rewardValueText.trim() || null,
    min_hours_between_stamps: parseInt(cfg.minHoursBetweenStamps, 10) || 0,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'offer_id' });
}

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

async function getRetailerCtx(): Promise<{ userId: string; retailerId: string } | null> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect('/sign-in');

  const service = createServiceClient();
  const { data } = await service
    .from('retailer_users')
    .select('retailer_id')
    .eq('profile_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (!data) return null;
  return { userId: user.id, retailerId: data.retailer_id };
}

function buildRuleRow(offerId: string, fields: OfferFields) {
  const cols: RuleColumns = ruleToColumns(fields.redemptionRule);
  return {
    offer_id: offerId,
    max_redemptions_total: fields.totalCap.trim()
      ? parseInt(fields.totalCap, 10)
      : null,
    new_customers_only: fields.newCustomersOnly ?? false,
    ...cols,
  };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createOffer(fields: OfferFields): Promise<CreateOfferResult> {
  const fieldErrors = validateOffer(fields);
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const ctx = await getRetailerCtx();
  if (!ctx) return { error: 'No retailer account found.' };

  const service = createServiceClient();
  const derivedMeta = buildOfferMetaJson(fields.offerType, fields.offerMeta);
  const derivedSaving = autoDeriveSavingPence(fields.offerType, fields.discountValue);
  const derivedSummary = buildShortSummary(fields.offerType, fields.offerMeta ?? EMPTY_OFFER_META, fields.discountValue);
  const { data: offer, error } = await service
    .from('offers')
    .insert({
      retailer_id: ctx.retailerId,
      retailer_location_id: null,
      venue_scope: fields.venueScope,
      title: fields.headline.trim(),
      value_text: computeValueText(fields.offerType, fields.discountValue),
      description: fields.description.trim(),
      offer_type: fields.offerType,
      start_at: fields.startDate ? new Date(fields.startDate).toISOString() : null,
      end_at: fields.endDate ? new Date(fields.endDate).toISOString() : null,
      status: 'draft',
      created_by_profile_id: ctx.userId,
      image_url: fields.imageUrl.trim() || null,
      offer_meta: derivedMeta,
      // Only write columns we can derive — omitting them on INSERT gives NULL (correct for new offers).
      ...(derivedSaving !== null ? { estimated_saving_pence: derivedSaving } : {}),
      ...(derivedSummary !== null ? { short_summary: derivedSummary } : {}),
    })
    .select('id')
    .single();

  if (error || !offer) {
    console.error('[createOffer] insert error:', error?.message);
    return { error: 'Failed to create offer. Please try again.' };
  }

  await service.from('offer_rules').insert(buildRuleRow(offer.id, fields));

  if (fields.venueScope === 'specific' && fields.selectedLocationIds.length > 0) {
    await service.from('offer_locations').insert(
      fields.selectedLocationIds.map((locId) => ({
        offer_id: offer.id,
        retailer_location_id: locId,
      })),
    );
  }

  if (needsLoyaltyConfig(fields.offerType) && fields.loyaltyConfig) {
    await upsertLoyaltyConfig(service, offer.id, fields.loyaltyConfig);
  }
  if (needsVenueReferralConfig(fields.offerType) && fields.venueReferralConfig) {
    await upsertVenueReferralConfig(service, offer.id, fields.venueReferralConfig);
  }

  revalidatePath('/offers');
  return { offerId: offer.id };
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateOffer(
  offerId: string,
  fields: OfferFields,
): Promise<OfferActionResult | null> {
  const fieldErrors = validateOffer(fields);
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const ctx = await getRetailerCtx();
  if (!ctx) return { error: 'No retailer account found.' };

  const service = createServiceClient();

  // Verify ownership and get current state for material-change detection.
  const { data: existing } = await service
    .from('offers')
    .select('id, status, offer_type, value_text, title')
    .eq('id', offerId)
    .eq('retailer_id', ctx.retailerId)
    .maybeSingle();

  if (!existing) return { error: 'Offer not found.' };

  const newValueText = computeValueText(fields.offerType, fields.discountValue);
  const newTitle = fields.headline.trim();

  // Material change on a live or approved offer — return to pending review.
  const isMaterialChange =
    (existing.status === 'live' || existing.status === 'approved') &&
    (existing.offer_type !== fields.offerType ||
      existing.value_text !== newValueText ||
      existing.title !== newTitle);

  // Rejected offers revert to draft on save so the retailer can resubmit.
  let newStatus = existing.status;
  if (isMaterialChange) {
    newStatus = 'pending';
  } else if (existing.status === 'rejected') {
    newStatus = 'draft';
  }

  const statusChanged = newStatus !== existing.status;
  const derivedMeta = buildOfferMetaJson(fields.offerType, fields.offerMeta);
  const derivedSaving = autoDeriveSavingPence(fields.offerType, fields.discountValue);
  const derivedSummary = buildShortSummary(fields.offerType, fields.offerMeta ?? EMPTY_OFFER_META, fields.discountValue);

  const { error } = await service
    .from('offers')
    .update({
      retailer_location_id: null,
      venue_scope: fields.venueScope,
      title: newTitle,
      value_text: newValueText,
      description: fields.description.trim(),
      offer_type: fields.offerType,
      start_at: fields.startDate ? new Date(fields.startDate).toISOString() : null,
      end_at: fields.endDate ? new Date(fields.endDate).toISOString() : null,
      image_url: fields.imageUrl.trim() || null,
      offer_meta: derivedMeta,
      // Only write columns we can derive — omitting them on UPDATE preserves any admin-set values.
      ...(derivedSaving !== null ? { estimated_saving_pence: derivedSaving } : {}),
      ...(derivedSummary !== null ? { short_summary: derivedSummary } : {}),
      ...(statusChanged ? { status: newStatus } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', offerId);

  if (error) {
    console.error('[updateOffer] error:', error.message);
    return { error: 'Failed to save. Please try again.' };
  }

  await service
    .from('offer_rules')
    .upsert(
      { ...buildRuleRow(offerId, fields), updated_at: new Date().toISOString() },
      { onConflict: 'offer_id' },
    );

  // Replace offer_locations: delete all then reinsert if specific scope.
  await service.from('offer_locations').delete().eq('offer_id', offerId);
  if (fields.venueScope === 'specific' && fields.selectedLocationIds.length > 0) {
    await service.from('offer_locations').insert(
      fields.selectedLocationIds.map((locId) => ({
        offer_id: offerId,
        retailer_location_id: locId,
      })),
    );
  }

  if (needsLoyaltyConfig(fields.offerType) && fields.loyaltyConfig) {
    await upsertLoyaltyConfig(service, offerId, fields.loyaltyConfig);
  }
  if (needsVenueReferralConfig(fields.offerType) && fields.venueReferralConfig) {
    await upsertVenueReferralConfig(service, offerId, fields.venueReferralConfig);
  }

  revalidatePath(`/offers/${offerId}`);
  revalidatePath('/offers');
  return null;
}

// ---------------------------------------------------------------------------
// Status transitions (form actions — return void for <form action={...}>)
// ---------------------------------------------------------------------------

export async function submitOfferForApproval(formData: FormData): Promise<void> {
  const offerId = formData.get('offer_id') as string;
  const ctx = await getRetailerCtx();
  if (!ctx) return;

  const service = createServiceClient();
  const { data: offer } = await service
    .from('offers')
    .select('status')
    .eq('id', offerId)
    .eq('retailer_id', ctx.retailerId)
    .maybeSingle();

  if (!offer || offer.status !== 'draft') return;

  await service
    .from('offers')
    .update({ status: 'pending', updated_at: new Date().toISOString() })
    .eq('id', offerId);

  revalidatePath(`/offers/${offerId}`);
  revalidatePath('/offers');
}

export async function togglePauseOffer(formData: FormData): Promise<void> {
  const offerId = formData.get('offer_id') as string;
  const ctx = await getRetailerCtx();
  if (!ctx) return;

  const service = createServiceClient();
  const { data: offer } = await service
    .from('offers')
    .select('status')
    .eq('id', offerId)
    .eq('retailer_id', ctx.retailerId)
    .maybeSingle();

  if (!offer) return;
  if (!['live', 'paused'].includes(offer.status)) return;

  const newStatus = offer.status === 'paused' ? 'live' : 'paused';
  await service
    .from('offers')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', offerId);

  revalidatePath(`/offers/${offerId}`);
  revalidatePath('/offers');
}

export async function archiveOffer(formData: FormData): Promise<void> {
  const offerId = formData.get('offer_id') as string;
  const ctx = await getRetailerCtx();
  if (!ctx) return;

  const service = createServiceClient();
  const { data: offer } = await service
    .from('offers')
    .select('status')
    .eq('id', offerId)
    .eq('retailer_id', ctx.retailerId)
    .maybeSingle();

  if (!offer) return;
  if (!['live', 'paused', 'draft'].includes(offer.status)) return;

  await service
    .from('offers')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', offerId);

  revalidatePath('/offers');
  redirect('/offers');
}

export async function deleteDraftOffer(formData: FormData): Promise<void> {
  const offerId = formData.get('offer_id') as string;
  const ctx = await getRetailerCtx();
  if (!ctx) return;

  const service = createServiceClient();
  // Only draft offers may be deleted.
  await service
    .from('offers')
    .delete()
    .eq('id', offerId)
    .eq('retailer_id', ctx.retailerId)
    .eq('status', 'draft');

  revalidatePath('/offers');
  redirect('/offers');
}
