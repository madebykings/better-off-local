import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRetailerUser } from '@/lib/auth/require_retailer_user';
import { createServiceClient } from '@/lib/supabase/service';
import { PageHeader, StatusBadge, EmptyState } from '@better-off-local/ui';

export const metadata: Metadata = { title: 'Offers – Retailer Portal' };

type OfferRow = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  views: number;
  saves: number;
  redemptions: number;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default async function OffersPage() {
  const { retailerId } = await requireRetailerUser();
  const supabase = createServiceClient();

  const [offersResult, viewsResult, savesResult, redemptionsResult] =
    await Promise.all([
      supabase
        .from('offers')
        .select('id, title, status, created_at')
        .eq('retailer_id', retailerId)
        .order('created_at', { ascending: false }),
      supabase
        .from('offer_views')
        .select('offer_id')
        .eq('retailer_id', retailerId),
      supabase
        .from('favourites')
        .select('offer_id')
        .eq('retailer_id', retailerId)
        .not('offer_id', 'is', null),
      supabase
        .from('redemptions')
        .select('offer_id')
        .eq('retailer_id', retailerId)
        .eq('status', 'success'),
    ]);

  const viewsByOffer = new Map<string, number>();
  for (const v of viewsResult.data ?? []) {
    viewsByOffer.set(v.offer_id, (viewsByOffer.get(v.offer_id) ?? 0) + 1);
  }

  const savesByOffer = new Map<string, number>();
  for (const s of savesResult.data ?? []) {
    if (s.offer_id) {
      savesByOffer.set(s.offer_id, (savesByOffer.get(s.offer_id) ?? 0) + 1);
    }
  }

  const redemptionsByOffer = new Map<string, number>();
  for (const r of redemptionsResult.data ?? []) {
    if (r.offer_id) {
      redemptionsByOffer.set(
        r.offer_id,
        (redemptionsByOffer.get(r.offer_id) ?? 0) + 1,
      );
    }
  }

  const offers: OfferRow[] = (offersResult.data ?? []).map((o) => ({
    id: o.id,
    title: o.title,
    status: o.status,
    created_at: o.created_at,
    views: viewsByOffer.get(o.id) ?? 0,
    saves: savesByOffer.get(o.id) ?? 0,
    redemptions: redemptionsByOffer.get(o.id) ?? 0,
  }));

  return (
    <div>
      <PageHeader
        title="Offers"
        description="All your offers with view, save, and redemption counts."
        action={
          <Link
            href="/offers/new"
            className="text-sm bg-green-800 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            New offer
          </Link>
        }
      />

      {offers.length === 0 ? (
        <EmptyState
          icon="🏷️"
          title="No offers yet"
          description="Create your first offer to start attracting members."
          action={
            <Link
              href="/offers/new"
              className="text-sm bg-green-800 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              New offer
            </Link>
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Title</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Views</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Saves</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Redeemed</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {offers.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium max-w-[220px] truncate">
                      <Link
                        href={`/offers/${o.id}`}
                        className="text-gray-800 hover:text-green-700 hover:underline"
                      >
                        {o.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {o.views}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {o.saves}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {o.redemptions}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {formatDate(o.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link
                        href={`/offers/${o.id}`}
                        className="text-xs font-medium text-green-700 hover:text-green-900 hover:underline"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {offers.map((o) => (
              <div key={o.id} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/offers/${o.id}`} className="font-medium text-gray-800 hover:text-green-700 min-w-0 truncate block">
                    {o.title}
                  </Link>
                  <StatusBadge status={o.status} />
                </div>
                <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                  <span>{o.views} views</span>
                  <span>{o.saves} saves</span>
                  <span>{o.redemptions} redeemed</span>
                </div>
                <p className="text-xs text-gray-400 mt-2">{formatDate(o.created_at)}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
