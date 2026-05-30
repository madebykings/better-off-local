import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRetailerUser } from '@/lib/auth/require_retailer_user';
import { createServiceClient } from '@/lib/supabase/service';
import { NewVenueForm } from './new_venue_form';

export const metadata: Metadata = { title: 'Add Location – Retailer Portal' };

export default async function NewLocationPage() {
  const { retailerId } = await requireRetailerUser();
  const supabase = createServiceClient();

  const [{ count: activeCount }, { data: regionRows }] = await Promise.all([
    supabase
      .from('retailer_locations')
      .select('id', { count: 'exact', head: true })
      .eq('retailer_id', retailerId)
      .eq('is_active', true),
    supabase
      .from('regions')
      .select('id, name, member_threshold, is_active')
      .eq('is_active', true)
      .order('name'),
  ]);

  // Fetch active member count for each region in parallel.
  const regionsWithCounts = await Promise.all(
    (regionRows ?? []).map(async (r) => {
      const { data: count } = await supabase.rpc('region_active_member_count', { p_region_id: r.id });
      return {
        id: r.id,
        name: r.name,
        member_threshold: r.member_threshold,
        active_member_count: (count as number | null) ?? 0,
      };
    }),
  );

  const count = activeCount ?? 0;

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
          <Link href="/locations" className="hover:text-gray-600 transition-colors">Locations</Link>
          <span>›</span>
          <span className="text-gray-600">Add location</span>
        </div>
        <h1 className="text-2xl font-semibold">Add location</h1>
        {count > 0 && (
          <p className="mt-1 text-sm text-gray-500">
            Adding venue {count + 1}. Region determines whether a charge applies.
          </p>
        )}
      </div>

      <NewVenueForm regions={regionsWithCounts} isPrimaryVenue={count === 0} />
    </div>
  );
}
