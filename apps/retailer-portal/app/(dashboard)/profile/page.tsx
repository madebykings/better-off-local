import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRetailerUser } from '@/lib/auth/require_retailer_user';
import { createServiceClient } from '@/lib/supabase/service';
import { ProfileForm } from './profile_form';
import type { ProfileFields } from '@/lib/actions/profile';

export const metadata: Metadata = { title: 'Profile – Retailer Portal' };

export default async function ProfilePage() {
  const { retailerId } = await requireRetailerUser();
  const supabase = createServiceClient();

  const [{ data: retailer }, { data: categoryRows }, { data: venueRows }] = await Promise.all([
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
    supabase
      .from('retailer_locations')
      .select('id, name, address_line_1, town, postcode, is_primary, is_active')
      .eq('retailer_id', retailerId)
      .order('is_primary', { ascending: false })
      .order('name'),
  ]);

  const categoryNames = (categoryRows ?? []).map((c) => c.name as string);
  const venues = venueRows ?? [];

  const initialData: ProfileFields = {
    name:             (retailer as any)?.name             ?? '',
    shortDescription: (retailer as any)?.short_description ?? '',
    contactName:      (retailer as any)?.contact_name      ?? '',
    businessType:     (retailer as any)?.business_type     ?? '',
    phone:            (retailer as any)?.phone             ?? '',
    email:            (retailer as any)?.email             ?? '',
  };

  return (
    <div className="max-w-xl space-y-8">
      <div>
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

      {/* ── Venues ──────────────────────────────────────────────────────── */}
      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Your venues
          </h2>
          <Link
            href="/locations/new"
            className="text-xs font-medium text-green-700 hover:text-green-900 hover:underline"
          >
            + Add venue
          </Link>
        </div>

        {venues.length === 0 ? (
          <p className="text-sm text-gray-400">
            No venues yet.{' '}
            <Link href="/locations/new" className="text-green-700 underline">
              Add your first venue
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {venues.map((v: any) => {
              const addressParts = [v.address_line_1, v.town, v.postcode].filter(Boolean);
              return (
                <li key={v.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800 truncate">
                        {v.name ?? 'Unnamed venue'}
                      </span>
                      {v.is_primary && (
                        <span className="shrink-0 rounded border border-green-200 bg-green-50 px-1.5 py-0.5 text-[11px] font-medium text-green-700">
                          Primary
                        </span>
                      )}
                      {!v.is_active && (
                        <span className="shrink-0 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[11px] font-medium text-gray-500">
                          Inactive
                        </span>
                      )}
                    </div>
                    {addressParts.length > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {addressParts.join(', ')}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/locations/${v.id}`}
                    className="ml-4 shrink-0 text-xs font-medium text-green-700 hover:text-green-900 hover:underline"
                  >
                    Edit
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
