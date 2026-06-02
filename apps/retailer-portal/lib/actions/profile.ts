'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export interface ProfileFields {
  name: string;
  shortDescription: string; // → retailers.short_description
  contactName: string;      // → retailers.contact_name
  businessType: string;
  phone: string;            // → retailers.phone (owner/contact phone)
  email: string;            // → retailers.email (owner/contact email)
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
  if (fields.shortDescription.trim().length < 10) {
    errors.shortDescription = 'Short description must be at least 10 characters.';
  }
  if (fields.shortDescription.trim().length > 160) {
    errors.shortDescription = 'Short description must be 160 characters or fewer.';
  }
  if (!fields.businessType) {
    errors.businessType = 'Please select a business type.';
  }
  return errors;
}

/**
 * Updates the authenticated retailer's brand identity and owner contact details.
 * Venue-specific public fields (description, phone, website) are edited on the
 * venue / location page, not here.
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
      name:              fields.name.trim(),
      short_description: fields.shortDescription.trim(),
      contact_name:      fields.contactName.trim() || null,
      business_type:     fields.businessType || null,
      phone:             fields.phone.trim() || null,
      email:             fields.email.trim() || null,
      updated_at:        new Date().toISOString(),
    })
    .eq('id', link.retailer_id);

  if (error) {
    console.error('[updateRetailerProfile] error:', error.message);
    return { error: 'Failed to save. Please try again.' };
  }

  revalidatePath('/profile');
  return null;
}
