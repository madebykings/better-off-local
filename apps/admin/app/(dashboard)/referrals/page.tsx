import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';
import { voidReferralReward, approveReferralReward } from '@/lib/actions/referrals';

export const metadata: Metadata = { title: 'Referrals – Admin' };

const STATUS_CLASSES: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-800 border-yellow-200',
  confirmed: 'bg-green-100 text-green-800 border-green-200',
  applied:   'bg-blue-100 text-blue-800 border-blue-200',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
  voided:    'bg-red-100 text-red-700 border-red-200',
  review:    'bg-amber-100 text-amber-800 border-amber-200',
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function fmtPence(pence: number | null) {
  if (!pence) return '—';
  return `£${(pence / 100).toFixed(2)}`;
}

interface Props {
  searchParams: Promise<{ status?: string }>;
}

export default async function ReferralsPage({ searchParams }: Props) {
  await requireAdmin();
  const { status } = await searchParams;
  const supabase = createServiceClient();

  const { data: config } = await supabase
    .from('referral_config')
    .select('reward_months, friend_reward_months, cap_per_year, grace_days')
    .eq('id', 1)
    .maybeSingle();

  let query = supabase
    .from('referral_rewards')
    .select(
      'id, status, reward_months, reward_amount_pence, applied_at, confirmed_at, voided_at, void_reason, stripe_balance_txn_id, created_at, ' +
      'referral_invitations!inner(attributed_at, invitee:profiles!referral_invitations_invitee_profile_id_fkey(full_name, email), ' +
      'referral_codes!inner(code, referrer:profiles!referral_codes_profile_id_fkey(full_name, email)))',
    )
    .order('created_at', { ascending: false })
    .limit(200);

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data: rows, error } = await query;
  const rewards = (rows ?? []) as any[];

  const statuses = ['all', 'review', 'pending', 'confirmed', 'applied', 'cancelled', 'voided'];

  if (error) {
    return (
      <div className="text-red-600 text-sm p-4">
        Error loading referrals: {error.message}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Referrals</h1>
        <p className="mt-1 text-sm text-gray-500">
          Member referral programme rewards. Rewards in <strong>Review</strong> exceeded the annual rate limit and need manual approval.
        </p>
      </div>

      {/* Config summary */}
      {config && (
        <div className="flex flex-wrap gap-3 mb-6">
          {[
            { label: 'Referrer reward', value: `${config.reward_months} month${config.reward_months !== 1 ? 's' : ''}` },
            { label: 'Friend reward', value: `${config.friend_reward_months} month${config.friend_reward_months !== 1 ? 's' : ''}` },
            { label: 'Cap per year', value: `${config.cap_per_year} months` },
            { label: 'Grace period', value: `${config.grace_days} days` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-sm">
              <span className="text-gray-500">{label}:</span>{' '}
              <span className="font-semibold text-gray-800">{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Status filter */}
      <div className="flex flex-wrap gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-4">
        {statuses.map((s) => {
          const isActive = (status ?? 'all') === s;
          return (
            <a
              key={s}
              href={`/referrals${s === 'all' ? '' : `?status=${s}`}`}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors capitalize ${
                isActive ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {s}
            </a>
          );
        })}
      </div>

      {rewards.length === 0 ? (
        <div className="text-center py-12 text-gray-400 border border-gray-200 rounded-lg bg-white">
          <p className="text-sm">No referral rewards found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Referrer</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Code</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Friend</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Reward</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rewards.map((r: any) => {
                const invitation = r.referral_invitations;
                const referrer = invitation?.referral_codes?.referrer;
                const invitee = invitation?.invitee;
                const code = invitation?.referral_codes?.code;
                const statusCls = STATUS_CLASSES[r.status] ?? 'bg-gray-100 text-gray-600 border-gray-200';

                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{referrer?.full_name ?? '—'}</p>
                      <p className="text-xs text-gray-400">{referrer?.email ?? ''}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{code ?? '—'}</td>
                    <td className="px-4 py-3">
                      <p className="text-gray-800">{invitee?.full_name ?? '—'}</p>
                      <p className="text-xs text-gray-400">{invitee?.email ?? ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${statusCls}`}>
                        {r.status}
                      </span>
                      {r.void_reason && (
                        <p className="text-xs text-gray-400 mt-0.5 max-w-[140px] truncate" title={r.void_reason}>
                          {r.void_reason}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {r.reward_months ? `${r.reward_months} month${r.reward_months !== 1 ? 's' : ''}` : fmtPence(r.reward_amount_pence)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        {r.status === 'review' && (
                          <form action={approveReferralReward}>
                            <input type="hidden" name="reward_id" value={r.id} />
                            <button
                              type="submit"
                              className="text-xs text-green-700 hover:text-green-900 underline font-medium"
                            >
                              Approve
                            </button>
                          </form>
                        )}
                        {(r.status === 'pending' || r.status === 'review') && (
                          <form action={voidReferralReward}>
                            <input type="hidden" name="reward_id" value={r.id} />
                            <input type="hidden" name="reason" value="Voided by admin" />
                            <button
                              type="submit"
                              className="text-xs text-red-500 hover:text-red-700 underline"
                            >
                              Void
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-4 py-2.5 border-t border-gray-100 text-xs text-gray-400">
            {rewards.length} reward{rewards.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
}
