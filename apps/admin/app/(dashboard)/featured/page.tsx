import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';
import { toggleOfferFeatured } from '@/lib/actions/admin';

export const metadata: Metadata = { title: 'Featured – Admin' };

const STATUS_CLASSES: Record<string, string> = {
  live:    'bg-green-100 text-green-800 border-green-200',
  paused:  'bg-yellow-100 text-yellow-800 border-yellow-200',
  expired: 'bg-gray-100 text-gray-700 border-gray-200',
  pending: 'bg-blue-100 text-blue-800 border-blue-200',
  draft:   'bg-gray-100 text-gray-500 border-gray-200',
};

export default async function FeaturedPage() {
  await requireAdmin();
  const supabase = createServiceClient();

  const [featuredResult, liveResult] = await Promise.all([
    // Currently featured offers
    supabase
      .from('offers')
      .select('id, title, status, is_featured, retailers(name)')
      .eq('is_featured', true)
      .order('title'),
    // Live offers not yet featured (for promotion)
    supabase
      .from('offers')
      .select('id, title, status, is_featured, retailers(name)')
      .eq('is_featured', false)
      .eq('status', 'live')
      .order('title')
      .limit(50),
  ]);

  const featured = (featuredResult.data ?? []) as any[];
  const promotable = (liveResult.data ?? []) as any[];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Featured</h1>
        <p className="mt-1 text-sm text-gray-500">
          Featured offers are shown prominently in the consumer app.
        </p>
      </div>

      {/* Currently featured */}
      <div className="mb-8">
        <h2 className="text-base font-semibold text-gray-800 mb-3">
          Currently featured ({featured.length})
        </h2>
        {featured.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400 border border-gray-200 rounded-lg bg-white">
            No featured offers.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Offer</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Retailer</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {featured.map((o: any) => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{o.title}</td>
                    <td className="px-4 py-3 text-gray-600">{o.retailers?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${STATUS_CLASSES[o.status] ?? ''}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <form action={toggleOfferFeatured}>
                        <input type="hidden" name="id" value={o.id} />
                        <input type="hidden" name="is_featured" value="true" />
                        <button type="submit" className="text-xs text-red-500 hover:text-red-700 underline">
                          Unfeature
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Live offers to promote */}
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-3">
          Live offers available to feature
        </h2>
        {promotable.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400 border border-gray-200 rounded-lg bg-white">
            No live offers available to feature.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Offer</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Retailer</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {promotable.map((o: any) => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{o.title}</td>
                    <td className="px-4 py-3 text-gray-600">{o.retailers?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <form action={toggleOfferFeatured}>
                        <input type="hidden" name="id" value={o.id} />
                        <input type="hidden" name="is_featured" value="false" />
                        <button type="submit" className="text-xs text-green-700 hover:text-green-900 underline font-medium">
                          Feature
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
