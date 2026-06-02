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
      .select('name, short_description, description, website_url, business_type, phone, logo_url, cover_image_url')
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
    name: retailer?.name ?? '',
    shortDescription: retailer?.short_description ?? '',
    description: retailer?.description ?? '',
    website: retailer?.website_url ?? '',
    businessType: retailer?.business_type ?? '',
    phone: retailer?.phone ?? '',
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Retailer profile</h1>
        <p className="mt-1 text-sm text-gray-500">
          This information appears on your public listing in the Better Off Local app.
        </p>
      </div>
      <ProfileForm
        initialData={initialData}
        logoUrl={retailer?.logo_url ?? null}
        coverUrl={retailer?.cover_image_url ?? null}
        categoryNames={categoryNames}
      />
    </div>
  );
}
