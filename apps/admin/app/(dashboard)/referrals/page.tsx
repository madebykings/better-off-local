import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';
import { markReferralPaid, cancelReferralReward, triggerEligibilityCheck } from '@/lib/actions/referrals';

export const metadata: Metadata = { title: 'Referrals – Admin' };

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function fmtPence(pence: number | null) {
  if (pence == null) return '—';
  return `£${(pence / 100).toFixed(2)}`;
}

const TYPE_LABELS: Record<string, string> = {
  member: 'Member referral',
  venue: 'Venue referral',
};

interface Props {
  searchParams: Promise<{ tab?: string }>;
}

export default async function ReferralsPage({ searchParams }: Props) {
  await requireAdmin();
  const { tab } = await searchParams;
  const activeTab = tab ?? 'eligible';

  const supabase = createServiceClient();

  // ── Summary counts ──────────────────────────────────────────────────────────

  const [
    { count: pendingCount },
    { count: eligibleCount },
    { count: paidCount },
  ] = await Promise.all([
    supabase.from('referral_rewards').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('referral_rewards').select('id', { count: 'exact', head: true }).eq('status', 'eligible'),
    supabase.from('referral_rewards').select('id', { count: 'exact', head: true }).eq('status', 'paid'),
  ]);

  // Total eligible payout amount
  const { data: eligibleAmounts } = await supabase
    .from('referral_rewards')
    .select('reward_amount_pence')
    .eq('status', 'eligible');

  const totalEligiblePence = (eligibleAmounts ?? []).reduce(
    (sum, r) => sum + (r.reward_amount_pence ?? 0),
    0,
  );

  // ── Reward rows ─────────────────────────────────────────────────────────────

  const baseSelect =
    'id, reward_type, reward_amount_pence, status, created_at, eligible_at, paid_at, notes, ' +
    'referrer:profiles!referral_rewards_referrer_profile_id_fkey(full_name, email, paypal_email), ' +
    'referral_invitations(invitee:profiles!referral_invitations_invitee_profile_id_fkey(full_name, email), ' +
    'referral_codes!inner(code)), ' +
    'retailer:retailers!referral_rewards_referred_retailer_id_fkey(name)';

  const { data: eligible } = await supabase
    .from('referral_rewards')
    .select(baseSelect)
    .eq('status', 'eligible')
    .order('eligible_at', { ascending: false })
    .limit(200);

  const { data: pending } = await supabase
    .from('referral_rewards')
    .select(baseSelect)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(200);

  const { data: paid } = await supabase
    .from('referral_rewards')
    .select(baseSelect)
    .eq('status', 'paid')
    .order('paid_at', { ascending: false })
    .limit(200);

  const rows: Record<string, any[]> = {
    eligible: eligible ?? [],
    pending: pending ?? [],
    paid: paid ?? [],
  };

  const tabs = [
    { key: 'eligible', label: 'Eligible', count: eligibleCount ?? 0 },
    { key: 'pending',  label: 'Pending',  count: pendingCount ?? 0 },
    { key: 'paid',     label: 'Paid',     count: paidCount ?? 0 },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Referrals</h1>
          <p className="mt-1 text-sm text-gray-500">
            Flat-rate PayPal payouts. Member referrals earn £2.00; venue referrals earn £10.00.
            Rewards become eligible after 30 days of active subscription.
          </p>
        </div>
        <form action={triggerEligibilityCheck}>
          <button
            type="submit"
            className="shrink-0 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Run eligibility check
          </button>
        </form>
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Pending',          value: String(pendingCount ?? 0),     sub: 'Awaiting 30-day window' },
          { label: 'Eligible',         value: String(eligibleCount ?? 0),    sub: 'Ready to pay out' },
          { label: 'Eligible payout',  value: fmtPence(totalEligiblePence),  sub: 'Total awaiting PayPal' },
          { label: 'Paid',             value: String(paidCount ?? 0),        sub: 'All time' },
        ].map(({ label, value, sub }) => (
          <div key={label} className="rounded-lg border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="mt-0.5 text-xl font-semibold text-gray-900">{value}</p>
            <p className="text-xs text-gray-400">{sub}</p>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-4">
        {tabs.map(({ key, label, count }) => (
          <a
            key={key}
            href={`/referrals?tab=${key}`}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              activeTab === key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
            {count > 0 && (
              <span className={`ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-xs font-medium ${
                activeTab === key ? 'bg-gray-100 text-gray-600' : 'bg-gray-200 text-gray-500'
              }`}>
                {count}
              </span>
            )}
          </a>
        ))}
      </div>

      {/* Table */}
      <RewardsTable rows={rows[activeTab] ?? []} tab={activeTab} />
    </div>
  );
}

function RewardsTable({ rows, tab }: { rows: any[]; tab: string }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white py-12 text-center text-sm text-gray-400">
        No rewards in this category.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-gray-200 bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Referrer</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">PayPal email</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Type</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Referred</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Amount</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">
              {tab === 'paid' ? 'Paid on' : tab === 'eligible' ? 'Eligible since' : 'Created'}
            </th>
            {tab !== 'paid' && <th className="px-4 py-3" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r: any) => {
            const referrer = r.referrer;
            const invitee = r.referral_invitations?.invitee;
            const code = r.referral_invitations?.referral_codes?.code;
            const venueName = r.retailer?.name;

            const dateValue = tab === 'paid'
              ? r.paid_at
              : tab === 'eligible'
              ? r.eligible_at
              : r.created_at;

            return (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800">{referrer?.full_name ?? '—'}</p>
                  <p className="text-xs text-gray-400">{referrer?.email ?? ''}</p>
                </td>
                <td className="px-4 py-3">
                  {referrer?.paypal_email ? (
                    <span className="font-mono text-xs text-gray-700">{referrer.paypal_email}</span>
                  ) : (
                    <span className="text-xs text-amber-600">Not set</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {TYPE_LABELS[r.reward_type] ?? r.reward_type}
                  {code && (
                    <span className="ml-1.5 font-mono text-xs text-gray-400">{code}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {r.reward_type === 'venue' ? (
                    <span className="text-gray-700">{venueName ?? '—'}</span>
                  ) : (
                    <>
                      <p className="text-gray-700">{invitee?.full_name ?? '—'}</p>
                      <p className="text-xs text-gray-400">{invitee?.email ?? ''}</p>
                    </>
                  )}
                </td>
                <td className="px-4 py-3 font-medium text-gray-800">
                  {fmtPence(r.reward_amount_pence)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                  {fmtDate(dateValue)}
                </td>
                {tab !== 'paid' && (
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      {tab === 'eligible' && (
                        <form action={markReferralPaid}>
                          <input type="hidden" name="reward_id" value={r.id} />
                          <button
                            type="submit"
                            className="text-xs font-medium text-green-700 underline hover:text-green-900"
                          >
                            Mark paid
                          </button>
                        </form>
                      )}
                      <form action={cancelReferralReward}>
                        <input type="hidden" name="reward_id" value={r.id} />
                        <input type="hidden" name="reason" value="Cancelled by admin" />
                        <button
                          type="submit"
                          className="text-xs text-red-500 underline hover:text-red-700"
                        >
                          Cancel
                        </button>
                      </form>
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={tab === 'paid' ? 6 : 7} className="border-t border-gray-100 px-4 py-2.5 text-xs text-gray-400">
              {rows.length} reward{rows.length !== 1 ? 's' : ''}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
