import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRetailerUser } from '@/lib/auth/require_retailer_user';
import { createServiceClient } from '@/lib/supabase/service';

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

const STATUS_LABELS: Record<string, { label: string; classes: string }> = {
  live: { label: 'Live', classes: 'bg-green-100 text-green-800 border-green-200' },
  draft: { label: 'Draft', classes: 'bg-gray-100 text-gray-700 border-gray-200' },
  pending: { label: 'Pending approval', classes: 'bg-amber-100 text-amber-800 border-amber-200' },
  paused: { label: 'Paused', classes: 'bg-orange-100 text-orange-800 border-orange-200' },
  expired: { label: 'Expired', classes: 'bg-red-100 text-red-800 border-red-200' },
  rejected: { label: 'Rejected', classes: 'bg-red-100 text-red-800 border-red-200' },
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Offers</h1>
          <p className="text-sm text-gray-500 mt-1">
            All your offers with view, save, and redemption counts.
          </p>
        </div>
        <Link
          href="/offers/new"
          className="text-sm bg-green-800 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
        >
          New offer
        </Link>
      </div>

      {offers.length === 0 ? (
        <div className="text-center py-16 text-gray-400 border border-gray-200 rounded-lg">
          <p className="text-4xl mb-3">🏷️</p>
          <p className="font-medium text-gray-600">No offers yet</p>
          <p className="text-sm mt-1">
            Create your first offer to start attracting members.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
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
              {offers.map((o) => {
                const badge = STATUS_LABELS[o.status] ?? {
                  label: o.status,
                  classes: 'bg-gray-100 text-gray-600 border-gray-200',
                };
                return (
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
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${badge.classes}`}
                      >
                        {badge.label}
                      </span>
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
