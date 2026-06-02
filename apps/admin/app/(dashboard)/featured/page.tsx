import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';
import { toggleVenueFeatured } from '@/lib/actions/admin';

export const metadata: Metadata = { title: 'Featured – Admin' };

export default async function FeaturedPage() {
  await requireAdmin();
  const supabase = createServiceClient();

  const [featuredResult, availableResult] = await Promise.all([
    supabase
      .from('retailer_locations')
      .select('id, retailer_id, name, is_active, logo_url, cover_image_url, retailers(name), regions(name)')
      .eq('is_featured', true)
      .order('name'),
    supabase
      .from('retailer_locations')
      .select('id, retailer_id, name, is_active, logo_url, cover_image_url, retailers(name), regions(name)')
      .eq('is_featured', false)
      .eq('is_active', true)
      .order('name')
      .limit(100),
  ]);

  const featured  = (featuredResult.data  ?? []) as any[];
  const available = (availableResult.data ?? []) as any[];

  function VenueRow({ v, currentFeatured }: { v: any; currentFeatured: boolean }) {
    return (
      <tr className="hover:bg-gray-50">
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            {v.logo_url && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={v.logo_url} alt="" className="w-8 h-8 rounded object-cover border border-gray-100 shrink-0" />
            )}
            {!v.logo_url && v.cover_image_url && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={v.cover_image_url} alt="" className="w-8 h-8 rounded object-cover border border-gray-100 shrink-0" />
            )}
            {!v.logo_url && !v.cover_image_url && (
              <div className="w-8 h-8 rounded border border-gray-100 bg-gray-50 shrink-0" />
            )}
            <span className="font-medium text-gray-800">{v.name ?? '—'}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-gray-600">{v.retailers?.name ?? '—'}</td>
        <td className="px-4 py-3 text-gray-500 text-xs">{v.regions?.name ?? '—'}</td>
        <td className="px-4 py-3">
          {v.is_active ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border bg-green-100 text-green-800 border-green-200">
              Active
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border bg-gray-100 text-gray-500 border-gray-200">
              Inactive
            </span>
          )}
        </td>
        <td className="px-4 py-3">
          <form action={toggleVenueFeatured}>
            <input type="hidden" name="location_id" value={v.id} />
            <input type="hidden" name="retailer_id" value={v.retailer_id} />
            <input type="hidden" name="is_featured" value={String(currentFeatured)} />
            <button
              type="submit"
              className={
                currentFeatured
                  ? 'text-xs text-red-500 hover:text-red-700 underline'
                  : 'text-xs text-green-700 hover:text-green-900 underline font-medium'
              }
            >
              {currentFeatured ? 'Unfeature' : 'Feature'}
            </button>
          </form>
        </td>
      </tr>
    );
  }

  const tableHead = (
    <thead className="bg-gray-50 border-b border-gray-200">
      <tr>
        <th className="text-left px-4 py-3 font-medium text-gray-600">Venue</th>
        <th className="text-left px-4 py-3 font-medium text-gray-600">Retailer</th>
        <th className="text-left px-4 py-3 font-medium text-gray-600">Region</th>
        <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
        <th className="px-4 py-3" />
      </tr>
    </thead>
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Featured venues</h1>
        <p className="mt-1 text-sm text-gray-500">
          Featured venues are shown prominently in the consumer app. Feature individual locations, not the whole retailer.
        </p>
      </div>

      {/* Currently featured */}
      <div className="mb-8">
        <h2 className="text-base font-semibold text-gray-800 mb-3">
          Currently featured ({featured.length})
        </h2>
        {featured.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400 border border-gray-200 rounded-lg bg-white">
            No featured venues.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              {tableHead}
              <tbody className="divide-y divide-gray-100">
                {featured.map((v: any) => (
                  <VenueRow key={v.id} v={v} currentFeatured={true} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Active venues available to feature */}
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-3">
          Active venues available to feature
        </h2>
        {available.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400 border border-gray-200 rounded-lg bg-white">
            No active venues available to feature.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              {tableHead}
              <tbody className="divide-y divide-gray-100">
                {available.map((v: any) => (
                  <VenueRow key={v.id} v={v} currentFeatured={false} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
