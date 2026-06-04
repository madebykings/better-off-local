import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';

export const metadata: Metadata = { title: 'Loyalty Cards – Admin' };

type CardRow = {
  id: string;
  status: string;
  stamps_earned: number;
  stamps_required: number;
  created_at: string;
  completed_at: string | null;
  claimed_at: string | null;
  offer_id: string;
  profile_id: string;
  retailer_id: string;
  offers: { title: string; retailer_id: string } | null;
  profiles: { full_name: string | null } | null;
  retailers: { name: string } | null;
};

type StampRow = {
  id: string;
  stamped_at: string;
  loyalty_card_id: string;
  stamped_by_profile_id: string | null;
  retailer_location_id: string | null;
  loyalty_cards: {
    offer_id: string;
    profile_id: string;
    offers: { title: string } | null;
    profiles: { full_name: string | null } | null;
  } | null;
  stamped_by: { full_name: string | null } | null;
};

const STATUS_CLASSES: Record<string, string> = {
  active:    'bg-blue-100 text-blue-800 border-blue-200',
  completed: 'bg-teal-100 text-teal-800 border-teal-200',
  claimed:   'bg-green-100 text-green-800 border-green-200',
  expired:   'bg-gray-100 text-gray-600 border-gray-200',
};

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export default async function LoyaltyPage() {
  await requireAdmin();
  const supabase = createServiceClient();

  const [cardsResult, stampsResult, offersResult] = await Promise.all([
    supabase
      .from('loyalty_cards')
      .select(
        'id, status, stamps_earned, stamps_required, created_at, completed_at, claimed_at, offer_id, profile_id, retailer_id, ' +
        'offers(title, retailer_id), ' +
        'profiles(full_name), ' +
        'retailers(name)'
      )
      .order('created_at', { ascending: false })
      .limit(200),

    supabase
      .from('loyalty_stamps')
      .select(
        'id, stamped_at, loyalty_card_id, stamped_by_profile_id, retailer_location_id, ' +
        'loyalty_cards(offer_id, profile_id, offers(title), profiles(full_name)), ' +
        'stamped_by:profiles!loyalty_stamps_stamped_by_profile_id_fkey(full_name)'
      )
      .order('stamped_at', { ascending: false })
      .limit(50),

    // Per-offer summary
    supabase
      .from('offers')
      .select('id, title, retailer_id, retailers(name)')
      .eq('offer_type', 'loyalty_visits')
      .in('status', ['live', 'paused', 'expired', 'draft', 'pending', 'approved']),
  ]);

  const cards = (cardsResult.data ?? []) as unknown as CardRow[];
  const stamps = (stampsResult.data ?? []) as unknown as StampRow[];
  const loyaltyOffers = (offersResult.data ?? []) as unknown as {
    id: string; title: string; retailer_id: string; retailers: { name: string } | null;
  }[];

  // Build per-offer stats
  const cardsByOffer = new Map<string, CardRow[]>();
  for (const card of cards) {
    const existing = cardsByOffer.get(card.offer_id) ?? [];
    existing.push(card);
    cardsByOffer.set(card.offer_id, existing);
  }

  const offerStats = loyaltyOffers.map((o) => {
    const offerCards = cardsByOffer.get(o.id) ?? [];
    return {
      id: o.id,
      title: o.title,
      retailerName: o.retailers?.name ?? '—',
      issued: offerCards.length,
      active: offerCards.filter((c) => c.status === 'active').length,
      completed: offerCards.filter((c) => c.status === 'completed').length,
      claimed: offerCards.filter((c) => c.status === 'claimed').length,
    };
  }).filter((o) => o.issued > 0 || loyaltyOffers.length <= 10);

  // Headline totals
  const totalIssued = cards.length;
  const totalActive = cards.filter((c) => c.status === 'active').length;
  const totalCompleted = cards.filter((c) => c.status === 'completed').length;
  const totalClaimed = cards.filter((c) => c.status === 'claimed').length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Loyalty Cards</h1>
        <p className="text-sm text-gray-500 mt-1">
          Stamp card audit trail and oversight across all retailers.
        </p>
      </div>

      {/* Headline metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Cards issued', value: totalIssued },
          { label: 'Active', value: totalActive },
          { label: 'Completed', value: totalCompleted },
          { label: 'Rewards claimed', value: totalClaimed },
        ].map((m) => (
          <div key={m.label} className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{m.label}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Per-offer breakdown */}
      {offerStats.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Per loyalty offer</h2>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Offer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Retailer</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Issued</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Active</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Completed</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Claimed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {offerStats.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 max-w-[200px]">
                      <Link href={`/offers/${o.id}`} className="font-medium text-gray-800 hover:underline truncate block">
                        {o.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-sm">{o.retailerName}</td>
                    <td className="px-3 py-3 text-right text-gray-700">{o.issued}</td>
                    <td className="px-3 py-3 text-right text-gray-700">{o.active}</td>
                    <td className="px-3 py-3 text-right text-gray-700">{o.completed}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{o.claimed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* All cards table */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-3">All cards {cards.length >= 200 && <span className="text-sm font-normal text-gray-400">(latest 200)</span>}</h2>
        {cards.length === 0 ? (
          <div className="border border-gray-200 rounded-lg py-12 text-center">
            <p className="font-medium text-gray-600">No loyalty cards yet</p>
            <p className="text-sm text-gray-400 mt-1">Cards will appear here once members start collecting stamps.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Member</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Offer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Retailer</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Progress</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Started</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Claimed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cards.map((c) => {
                  const statusClass = STATUS_CLASSES[c.status] ?? 'bg-gray-100 text-gray-600 border-gray-200';
                  return (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-800 max-w-[140px] truncate">
                        {(c.profiles as any)?.full_name ?? <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 max-w-[160px]">
                        <Link href={`/offers/${c.offer_id}`} className="text-gray-800 hover:underline truncate block">
                          {(c.offers as any)?.title ?? '—'}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-[140px] truncate">
                        {(c.retailers as any)?.name ?? '—'}
                      </td>
                      <td className="px-3 py-3 text-center text-gray-700 font-mono text-xs">
                        {c.stamps_earned}/{c.stamps_required}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${statusClass}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(c.created_at)}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(c.claimed_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent stamp audit trail */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Recent stamps</h2>
        {stamps.length === 0 ? (
          <div className="border border-gray-200 rounded-lg py-12 text-center">
            <p className="font-medium text-gray-600">No stamps yet</p>
            <p className="text-sm text-gray-400 mt-1">Stamps will appear here as members collect them.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Time</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Member</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Offer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Scanned by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stamps.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {formatTime(s.stamped_at)}
                    </td>
                    <td className="px-4 py-3 text-gray-800">
                      {(s.loyalty_cards as any)?.profiles?.full_name ?? <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-800 max-w-[180px] truncate">
                      {(s.loyalty_cards as any)?.offers?.title ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {(s.stamped_by as any)?.full_name ?? <span className="text-gray-400">—</span>}
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
