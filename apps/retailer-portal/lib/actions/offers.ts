'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { type RuleColumns, ruleToColumns } from '@/lib/utils/redemption_rules';
import { type OfferType, OFFER_TYPES } from '@/lib/utils/first_offer';
import type { RedemptionRule } from '@/lib/utils/redemption_rules';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OfferFields = {
  benefitText: string;
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
  estimatedSavingPence: string; // integer string in pence, or ''
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
  const { data: offer, error } = await service
    .from('offers')
    .insert({
      retailer_id: ctx.retailerId,
      retailer_location_id: null,
      venue_scope: fields.venueScope,
      title: fields.headline.trim(),
      value_text: fields.benefitText.trim(),
      description: fields.description.trim(),
      offer_type: fields.offerType,
      start_at: fields.startDate ? new Date(fields.startDate).toISOString() : null,
      end_at: fields.endDate ? new Date(fields.endDate).toISOString() : null,
      status: 'draft',
      created_by_profile_id: ctx.userId,
      image_url: fields.imageUrl.trim() || null,
      estimated_saving_pence: fields.estimatedSavingPence.trim()
        ? parseInt(fields.estimatedSavingPence, 10)
        : null,
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

  // Verify ownership.
  const { data: existing } = await service
    .from('offers')
    .select('id, status')
    .eq('id', offerId)
    .eq('retailer_id', ctx.retailerId)
    .maybeSingle();

  if (!existing) return { error: 'Offer not found.' };

  const { error } = await service
    .from('offers')
    .update({
      retailer_location_id: null,
      venue_scope: fields.venueScope,
      title: fields.headline.trim(),
      value_text: fields.benefitText.trim(),
      description: fields.description.trim(),
      offer_type: fields.offerType,
      start_at: fields.startDate ? new Date(fields.startDate).toISOString() : null,
      end_at: fields.endDate ? new Date(fields.endDate).toISOString() : null,
      image_url: fields.imageUrl.trim() || null,
      estimated_saving_pence: fields.estimatedSavingPence.trim()
        ? parseInt(fields.estimatedSavingPence, 10)
        : null,
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
