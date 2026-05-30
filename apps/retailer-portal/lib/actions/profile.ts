'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export interface ProfileFields {
  name: string;
  tagline: string;
  website: string;
  description: string;
  businessType: string;
  phone: string;
}

export interface ProfileActionResult {
  error?: string;
  fieldErrors?: Partial<Record<keyof ProfileFields, string>>;
}

function validate(fields: ProfileFields): Partial<Record<keyof ProfileFields, string>> {
  const errors: Partial<Record<keyof ProfileFields, string>> = {};
  if (fields.name.trim().length < 2) {
    errors.name = 'Business name is required (at least 2 characters).';
  }
  if (fields.description.trim().length < 20) {
    errors.description = 'Description must be at least 20 characters.';
  }
  if (!fields.businessType) {
    errors.businessType = 'Please select a business type.';
  }
  if (fields.website.trim()) {
    const raw = fields.website.trim();
    try {
      new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    } catch {
      errors.website = 'Please enter a valid website URL (e.g. https://yoursite.com).';
    }
  }
  return errors;
}

/**
 * Updates the authenticated retailer's public profile.
 * Does not advance the onboarding step — safe to call post-onboarding.
 */
export async function updateRetailerProfile(
  fields: ProfileFields,
): Promise<ProfileActionResult | null> {
  const fieldErrors = validate(fields);
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/sign-in');

  const service = createServiceClient();
  const { data: link } = await service
    .from('retailer_users')
    .select('retailer_id')
    .eq('profile_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (!link) return { error: 'No retailer account found.' };

  const { error } = await service
    .from('retailers')
    .update({
      name: fields.name.trim(),
      tagline: fields.tagline.trim() || null,
      website_url: fields.website.trim() || null,
      description: fields.description.trim(),
      business_type: fields.businessType || null,
      phone: fields.phone.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', link.retailer_id);

  if (error) {
    console.error('[updateRetailerProfile] error:', error.message);
    return { error: 'Failed to save. Please try again.' };
  }

  return null;
}
