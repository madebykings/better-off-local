import type { Metadata } from 'next';
import { requireRetailerUser } from '@/lib/auth/require_retailer_user';
import { createServiceClient } from '@/lib/supabase/service';
import { ProfileForm } from './profile_form';
import type { ProfileFields } from '@/lib/actions/profile';

export const metadata: Metadata = { title: 'Profile – Retailer Portal' };

export default async function ProfilePage() {
  const { retailerId } = await requireRetailerUser();
  const supabase = createServiceClient();

  const [{ data: retailer }, { data: categoryRows }] = await Promise.all([
    supabase
      .from('retailers')
      .select('name, short_description, contact_name, business_type, phone, email, logo_url')
      .eq('id', retailerId)
      .single(),
    supabase
      .from('categories')
      .select('name')
      .eq('is_active', true)
      .order('sort_order')
      .order('name'),
  ]);

  const categoryNames = (categoryRows ?? []).map((c) => c.name as string);

  const initialData: ProfileFields = {
    name:             (retailer as any)?.name             ?? '',
    shortDescription: (retailer as any)?.short_description ?? '',
    contactName:      (retailer as any)?.contact_name      ?? '',
    businessType:     (retailer as any)?.business_type     ?? '',
    phone:            (retailer as any)?.phone             ?? '',
    email:            (retailer as any)?.email             ?? '',
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Retailer profile</h1>
        <p className="mt-1 text-sm text-gray-500">
          Your brand identity and owner contact details. Venue-specific information
          (description, phone, website) is managed on the Locations page.
        </p>
      </div>
      <ProfileForm
        initialData={initialData}
        logoUrl={(retailer as any)?.logo_url ?? null}
        categoryNames={categoryNames}
      />
    </div>
  );
}
