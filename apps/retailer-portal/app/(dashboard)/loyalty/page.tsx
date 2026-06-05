import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRetailerUser } from '@/lib/auth/require_retailer_user';
import { createServiceClient } from '@/lib/supabase/service';
import { PageHeader, StatusBadge, EmptyState } from '@better-off-local/ui';

export const metadata: Metadata = { title: 'Loyalty – Retailer Portal' };

type OfferRow = { id: string; title: string; status: string; created_at: string };
type ConfigRow = { offer_id: string; stamps_required: number; reward_description: string; reward_type: string; min_hours_between_stamps: number };
type CardRow = { offer_id: string; status: string };

const COOLDOWN_LABELS: Record<number, string> = {
  0:  'No minimum',
  1:  '1 hr between stamps',
  4:  '4 hrs between stamps',
  20: '~Once per day',
  44: '~Once every 2 days',
};

function pct(n: number, d: number): string {
  return d === 0 ? '—' : `${Math.round((n / d) * 100)}%`;
}

export default async function LoyaltyPage() {
  const { retailerId } = await requireRetailerUser();
  const supabase = createServiceClient();

  const { data: offersData } = await supabase
    .from('offers')
    .select('id, title, status, created_at')
    .eq('retailer_id', retailerId)
    .eq('offer_type', 'loyalty_visits')
    .order('created_at', { ascending: false });

  const offers = (offersData ?? []) as OfferRow[];
  const offerIds = offers.map((o) => o.id);

  const [configResult, cardsResult] = await Promise.all([
    offerIds.length > 0
      ? supabase
          .from('offer_loyalty_config')
          .select('offer_id, stamps_required, reward_description, reward_type, min_hours_between_stamps')
          .in('offer_id', offerIds)
      : Promise.resolve({ data: [] as ConfigRow[] }),
    supabase
      .from('loyalty_cards')
      .select('offer_id, status')
      .eq('retailer_id', retailerId),
  ]);

  const configs = new Map<string, ConfigRow>(
    ((configResult.data ?? []) as ConfigRow[]).map((c) => [c.offer_id, c]),
  );

  const allCards = (cardsResult.data ?? []) as CardRow[];
  const totalCardsIssued = allCards.length;
  const totalActive = allCards.filter((c) => c.status === 'active').length;
  const totalCompleted = allCards.filter((c) => c.status === 'completed').length;
  const totalClaimed = allCards.filter((c) => c.status === 'claimed').length;

  const cardsByOffer = new Map<string, CardRow[]>();
  for (const card of allCards) {
    cardsByOffer.set(card.offer_id, [...(cardsByOffer.get(card.offer_id) ?? []), card]);
  }

  return (
    <div>
      <PageHeader
        title="Loyalty"
        description="Stamp card programmes — members collect stamps and earn rewards."
        action={
          <Link
            href="/loyalty/new"
            className="text-sm bg-green-800 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            Create loyalty programme
          </Link>
        }
      />

      {offers.length === 0 ? (
        <EmptyState
          title="No loyalty programmes yet"
          description="Create a stamp card programme to reward repeat visits."
          action={
            <Link
              href="/loyalty/new"
              className="inline-block text-sm bg-green-800 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              Create loyalty programme
            </Link>
          }
        />
      ) : (
        <>
          {/* Summary metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {[
              { label: 'Cards issued',     value: totalCardsIssued },
              { label: 'Active',           value: totalActive },
              { label: 'Completed',        value: totalCompleted },
              { label: 'Rewards claimed',  value: totalClaimed },
            ].map((m) => (
              <div key={m.label} className="rounded-lg border border-gray-200 bg-white p-4">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{m.label}</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900">{m.value}</p>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Programme</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Stamps</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Reward</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Cooldown</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Cards</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Active</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Claimed</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Claim %</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {offers.map((offer) => {
                  const cfg = configs.get(offer.id);
                  const cards = cardsByOffer.get(offer.id) ?? [];
                  const issued = cards.length;
                  const active = cards.filter((c) => c.status === 'active').length;
                  const claimed = cards.filter((c) => c.status === 'claimed').length;
                  return (
                    <tr key={offer.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-800 max-w-[180px] truncate">
                        {offer.title}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={offer.status} />
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {cfg ? `${cfg.stamps_required} stamps` : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate">
                        {cfg?.reward_description ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {cfg ? (COOLDOWN_LABELS[cfg.min_hours_between_stamps] ?? `${cfg.min_hours_between_stamps}h min`) : '—'}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-700">{issued}</td>
                      <td className="px-3 py-3 text-right text-gray-700">{active}</td>
                      <td className="px-3 py-3 text-right text-gray-700">{claimed}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{pct(claimed, issued)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Link
                          href={`/offers/${offer.id}`}
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

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {offers.map((offer) => {
              const cfg = configs.get(offer.id);
              const cards = cardsByOffer.get(offer.id) ?? [];
              const issued = cards.length;
              const claimed = cards.filter((c) => c.status === 'claimed').length;
              return (
                <div key={offer.id} className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/offers/${offer.id}`}
                      className="font-medium text-gray-800 hover:text-green-700 min-w-0 truncate block"
                    >
                      {offer.title}
                    </Link>
                    <StatusBadge status={offer.status} />
                  </div>
                  {cfg && (
                    <p className="text-xs text-gray-500 mt-2 truncate">
                      {cfg.stamps_required} stamps — {cfg.reward_description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                    <span>{issued} cards</span>
                    <span>{claimed} claimed</span>
                    <span>{pct(claimed, issued)} claim rate</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
