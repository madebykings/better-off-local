import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRetailerUser } from '@/lib/auth/require_retailer_user';
import { createServiceClient } from '@/lib/supabase/service';
import { PageHeader, EmptyState, StatusBadge } from '@better-off-local/ui';

export const metadata: Metadata = { title: 'Referrals – Retailer Portal' };

type OfferRow = { id: string; title: string; status: string };
type ConfigRow = {
  offer_id: string;
  reward_title: string;
  friend_reward_enabled: boolean;
  friend_reward_title: string | null;
  max_rewards_per_referrer: number | null;
};


function pct(n: number, d: number): string {
  return d === 0 ? '—' : `${Math.round((n / d) * 100)}%`;
}

export default async function ReferralsPage() {
  const { retailerId } = await requireRetailerUser();
  const supabase = createServiceClient();

  const { data: offersData } = await supabase
    .from('offers')
    .select('id, title, status')
    .eq('retailer_id', retailerId)
    .eq('offer_type', 'venue_referral')
    .order('created_at', { ascending: false });

  const offers = (offersData ?? []) as OfferRow[];
  const offerIds = offers.map((o) => o.id);

  const [configResult, shareTokensResult, invitationsResult, rewardsResult] =
    offerIds.length > 0
      ? await Promise.all([
          supabase
            .from('offer_venue_referral_config')
            .select('offer_id, reward_title, friend_reward_enabled, friend_reward_title, max_rewards_per_referrer')
            .in('offer_id', offerIds),
          supabase
            .from('venue_referral_share_tokens')
            .select('offer_id')
            .in('offer_id', offerIds),
          supabase
            .from('venue_referral_invitations')
            .select('offer_id, was_existing_member')
            .in('offer_id', offerIds),
          supabase
            .from('venue_referral_rewards')
            .select('offer_id, status')
            .in('offer_id', offerIds),
        ])
      : [
          { data: [] as ConfigRow[] },
          { data: [] as { offer_id: string }[] },
          { data: [] as { offer_id: string; was_existing_member: boolean | null }[] },
          { data: [] as { offer_id: string; status: string }[] },
        ];

  const configs = new Map<string, ConfigRow>(
    ((configResult.data ?? []) as ConfigRow[]).map((c) => [c.offer_id, c]),
  );

  type ShareRow = { offer_id: string };
  type InviteRow = { offer_id: string; was_existing_member: boolean | null };
  type RewardRow = { offer_id: string; status: string };

  const allShares = (shareTokensResult.data ?? []) as ShareRow[];
  const allInvites = (invitationsResult.data ?? []) as InviteRow[];
  const allRewards = (rewardsResult.data ?? []) as RewardRow[];

  const totalLinks = allShares.length;
  const totalInvited = allInvites.length;
  const totalNewBol = allInvites.filter((i) => i.was_existing_member === false).length;
  const totalUnlocked = allRewards.filter((r) => r.status === 'unlocked').length;
  const totalRedeemed = allRewards.filter((r) => r.status === 'redeemed').length;

  const sharesByOffer = new Map<string, number>();
  for (const r of allShares) sharesByOffer.set(r.offer_id, (sharesByOffer.get(r.offer_id) ?? 0) + 1);

  const invitesByOffer = new Map<string, number>();
  const newBolByOffer = new Map<string, number>();
  for (const r of allInvites) {
    invitesByOffer.set(r.offer_id, (invitesByOffer.get(r.offer_id) ?? 0) + 1);
    if (r.was_existing_member === false) {
      newBolByOffer.set(r.offer_id, (newBolByOffer.get(r.offer_id) ?? 0) + 1);
    }
  }

  const rewardsByOffer = new Map<string, { unlocked: number; redeemed: number }>();
  for (const r of allRewards) {
    const cur = rewardsByOffer.get(r.offer_id) ?? { unlocked: 0, redeemed: 0 };
    if (r.status === 'unlocked') cur.unlocked++;
    if (r.status === 'redeemed') cur.redeemed++;
    rewardsByOffer.set(r.offer_id, cur);
  }

  return (
    <div>
      <PageHeader
        title="Referrals"
        description="Refer-a-friend campaigns — members share a link and earn rewards when friends visit."
        action={
          <Link
            href="/referrals/new"
            className="text-sm bg-green-800 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            Create referral campaign
          </Link>
        }
      />

      {offers.length === 0 ? (
        <EmptyState
          icon="🤝"
          title="No referral campaigns yet"
          description="Create a refer-a-friend campaign to grow your customer base."
          action={
            <Link
              href="/referrals/new"
              className="inline-block text-sm bg-green-800 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              Create referral campaign
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
            {[
              { label: 'Links shared',     value: totalLinks },
              { label: 'Friends invited',  value: totalInvited },
              { label: 'New BOL signups',  value: totalNewBol },
              { label: 'Rewards unlocked', value: totalUnlocked },
              { label: 'Rewards redeemed', value: totalRedeemed },
            ].map((m) => (
              <div key={m.label} className="rounded-lg border border-gray-200 bg-white p-4">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{m.label}</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900">{m.value}</p>
              </div>
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Campaign</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Referrer reward</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Friend reward</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Max / member</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Links</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Invited</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">New BOL</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Unlocked</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Redeemed</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Conv. %</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {offers.map((offer) => {
                  const cfg = configs.get(offer.id);
                  const links = sharesByOffer.get(offer.id) ?? 0;
                  const invited = invitesByOffer.get(offer.id) ?? 0;
                  const newBol = newBolByOffer.get(offer.id) ?? 0;
                  const { unlocked = 0, redeemed = 0 } = rewardsByOffer.get(offer.id) ?? {};
                  const converted = unlocked + redeemed;
                  return (
                    <tr key={offer.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-800 max-w-[160px] truncate">
                        {offer.title}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={offer.status} />
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-[140px] truncate">
                        {cfg?.reward_title ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {cfg
                          ? cfg.friend_reward_enabled
                            ? cfg.friend_reward_title ?? 'Set'
                            : 'None'
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {cfg
                          ? cfg.max_rewards_per_referrer != null
                            ? `${cfg.max_rewards_per_referrer}`
                            : 'Unlimited'
                          : '—'}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-700">{links}</td>
                      <td className="px-3 py-3 text-right text-gray-700">{invited}</td>
                      <td className="px-3 py-3 text-right text-gray-700">{newBol}</td>
                      <td className="px-3 py-3 text-right text-gray-700">{unlocked}</td>
                      <td className="px-3 py-3 text-right text-gray-700">{redeemed}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{pct(converted, invited)}</td>
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

          <div className="md:hidden space-y-3">
            {offers.map((offer) => {
              const cfg = configs.get(offer.id);
              const links = sharesByOffer.get(offer.id) ?? 0;
              const invited = invitesByOffer.get(offer.id) ?? 0;
              const { unlocked = 0, redeemed = 0 } = rewardsByOffer.get(offer.id) ?? {};
              const converted = unlocked + redeemed;
              return (
                <div key={offer.id} className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-gray-800 text-sm leading-snug">{offer.title}</p>
                    <StatusBadge status={offer.status} />
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="text-gray-600">
                      <span className="text-xs text-gray-400 uppercase tracking-wide font-medium">Referrer reward: </span>
                      {cfg?.reward_title ?? '—'}
                    </p>
                    <p className="text-gray-600">
                      <span className="text-xs text-gray-400 uppercase tracking-wide font-medium">Friend reward: </span>
                      {cfg
                        ? cfg.friend_reward_enabled
                          ? cfg.friend_reward_title ?? 'Set'
                          : 'None'
                        : '—'}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
                    <div className="text-center">
                      <p className="text-xs text-gray-400">Links</p>
                      <p className="text-sm font-semibold text-gray-800">{links}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-400">Unlocked</p>
                      <p className="text-sm font-semibold text-gray-800">{unlocked + redeemed}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-400">Conv. %</p>
                      <p className="text-sm font-semibold text-gray-800">{pct(converted, invited)}</p>
                    </div>
                  </div>
                  <div className="pt-1">
                    <Link
                      href={`/offers/${offer.id}`}
                      className="text-xs font-medium text-green-700 hover:text-green-900 hover:underline"
                    >
                      Edit campaign
                    </Link>
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
