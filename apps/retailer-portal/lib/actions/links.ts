'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import {
  URL_LINK_TYPES,
  type UrlLinkType,
  normaliseWebsite,
  normaliseInstagram,
  normaliseFacebook,
  normaliseTikTok,
  normaliseWhatsApp,
} from '@/lib/utils/links';

// ---------------------------------------------------------------------------
// Types
//
// Phone and email are saved directly to retailers.phone / retailers.email.
// URL-based links are saved to retailer_links with these type strings —
// a stable contract read by the Flutter consumer app.
// ---------------------------------------------------------------------------

export type LinksFields = {
  website: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  whatsapp: string;        // raw phone number — normalised to wa.me URL on save
  phone: string;
  email: string;
  preferredContactType: string; // one of URL_LINK_TYPES | 'phone' | 'email' | ''
};

export type LinksActionResult = {
  error?: string;
  fieldErrors?: Partial<Record<keyof LinksFields, string>>;
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateWebsite(raw: string): string | null {
  try {
    const parsed = new URL(normaliseWebsite(raw));
    if (!parsed.hostname.includes('.')) {
      return 'Please enter a valid website URL (e.g. yoursite.com).';
    }
    return null;
  } catch {
    return 'Please enter a valid website URL (e.g. yoursite.com).';
  }
}

function validateSocialHandle(raw: string, platform: string): string | null {
  const handle = raw.replace(/^@/, '').replace(/^(?:https?:\/\/)?(?:www\.)?\S+\.com\/@?/, '').trim();
  if (!handle) return `Please enter your ${platform} handle or page name.`;
  return null;
}

function validatePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10) {
    return 'Please enter a valid phone number (at least 10 digits).';
  }
  return null;
}

function validateEmail(raw: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim())) {
    return 'Please enter a valid email address.';
  }
  return null;
}

function validateLinks(
  fields: LinksFields,
): Partial<Record<keyof LinksFields, string>> {
  const errors: Partial<Record<keyof LinksFields, string>> = {};

  if (fields.website.trim())   { const e = validateWebsite(fields.website);               if (e) errors.website   = e; }
  if (fields.instagram.trim()) { const e = validateSocialHandle(fields.instagram, 'Instagram'); if (e) errors.instagram = e; }
  if (fields.facebook.trim())  { const e = validateSocialHandle(fields.facebook, 'Facebook');   if (e) errors.facebook  = e; }
  if (fields.tiktok.trim())    { const e = validateSocialHandle(fields.tiktok, 'TikTok');        if (e) errors.tiktok    = e; }
  if (fields.whatsapp.trim())  { const e = validatePhone(fields.whatsapp);                if (e) errors.whatsapp  = e; }
  if (fields.phone.trim())     { const e = validatePhone(fields.phone);                   if (e) errors.phone     = e; }
  if (fields.email.trim())     { const e = validateEmail(fields.email);                   if (e) errors.email     = e; }

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
// Save links
// ---------------------------------------------------------------------------

/**
 * Persists all link and contact fields for the authenticated retailer.
 *
 * Phone and email are stored on retailers.phone / retailers.email (dedicated
 * columns that exist for indexing and quick access by the consumer app).
 * URL-based links (website, instagram, facebook, tiktok, whatsapp) are stored
 * as retailer_links rows.
 *
 * TODO: Remove the phone field from the business-details onboarding step once
 * this links step is live. The links step is the canonical place for contact
 * info. The business-details phone field should be deprecated and hidden —
 * not removed from the DB column, as existing records may have data there.
 *
 * URL links are replaced with a delete-then-reinsert on every save. Empty
 * fields are not inserted (no row = not set).
 *
 * preferred_contact_type is saved to retailers and tells the consumer app
 * which CTA to feature prominently on the retailer detail screen.
 *
 * Advances onboarding_step to 'first-offer' only if currently on 'links'.
 * If the step advance fails, returns { error } to block navigation.
 */
export async function saveRetailerLinks(
  fields: LinksFields,
): Promise<LinksActionResult | null> {
  const fieldErrors = validateLinks(fields);
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

  // ── 1. Update retailers (phone, email, preferred_contact_type) ──────────
  const { error: retailerError } = await service
    .from('retailers')
    .update({
      phone: fields.phone.trim() || null,
      email: fields.email.trim() || null,
      preferred_contact_type: fields.preferredContactType || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', retailerId);

  if (retailerError) {
    console.error('[saveRetailerLinks] retailer update error:', retailerError.message);
    return { error: 'Failed to save contact details. Please try again.' };
  }

  // ── 2. Replace URL-based links (delete then reinsert) ──────────────────
  const { error: deleteError } = await service
    .from('retailer_links')
    .delete()
    .eq('retailer_id', retailerId)
    .in('type', URL_LINK_TYPES as unknown as string[]);

  if (deleteError) {
    console.error('[saveRetailerLinks] delete error:', deleteError.message);
    return { error: 'Failed to save links. Please try again.' };
  }

  const normalisers: Record<UrlLinkType, (v: string) => string> = {
    website:   normaliseWebsite,
    instagram: normaliseInstagram,
    facebook:  normaliseFacebook,
    tiktok:    normaliseTikTok,
    whatsapp:  normaliseWhatsApp,
  };

  const linkRows = URL_LINK_TYPES
    .filter((type) => fields[type].trim())
    .map((type) => ({
      retailer_id: retailerId,
      type,
      url: normalisers[type](fields[type]),
    }));

  if (linkRows.length > 0) {
    const { error: insertError } = await service
      .from('retailer_links')
      .insert(linkRows);

    if (insertError) {
      console.error('[saveRetailerLinks] insert error:', insertError.message);
      return { error: 'Failed to save links. Please try again.' };
    }
  }

  // ── 3. Advance step ─────────────────────────────────────────────────────
  if (retailer?.onboarding_step === 'links') {
    const { error: stepError } = await service
      .from('retailers')
      .update({ onboarding_step: 'first-offer', updated_at: new Date().toISOString() })
      .eq('id', retailerId);

    if (stepError) {
      console.error('[saveRetailerLinks] step advance error:', stepError.message);
      return {
        error: 'Your links were saved, but we could not advance to the next step. Please try again.',
      };
    }
  }

  return null;
}
