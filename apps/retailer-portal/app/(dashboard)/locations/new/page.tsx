import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRetailerUser } from '@/lib/auth/require_retailer_user';
import { createServiceClient } from '@/lib/supabase/service';
import { NewVenueForm } from './new_venue_form';
import { PageHeader, GuidanceCard } from '@better-off-local/ui';

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
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <Link href="/locations" className="hover:text-gray-600 transition-colors">Locations</Link>
        <span>›</span>
        <span className="text-gray-600">Add location</span>
      </div>

      <div className="max-w-xl">
        <PageHeader
          title="Add a new location"
          description="Add a trading address that will appear on the map for members to find."
        />
        {count > 0 && (
          <p className="text-sm text-gray-500 -mt-4 mb-6">
            Adding venue {count + 1}. Region determines whether a charge applies.
          </p>
        )}
        <div className="mb-6">
          <GuidanceCard
            icon="📍"
            heading="Each location needs a region"
            body="Your region determines when billing activates. During our launch growth phase, venues in Clackmannanshire are free until we reach our member target."
          />
        </div>
        <NewVenueForm regions={regionsWithCounts} isPrimaryVenue={count === 0} />
      </div>
    </div>
  );
}
