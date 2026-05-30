import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';
import { cancelMembership } from '@/lib/actions/admin';

export const metadata: Metadata = { title: 'Member – Admin' };

const STATUS_CLASSES: Record<string, string> = {
  active:   'bg-green-100 text-green-800 border-green-200',
  trialing: 'bg-blue-100 text-blue-800 border-blue-200',
  past_due: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  cancelled:'bg-red-100 text-red-800 border-red-200',
  expired:  'bg-gray-100 text-gray-700 border-gray-200',
  inactive: 'bg-gray-100 text-gray-500 border-gray-200',
};

const REDEMPTION_STATUS_CLASSES: Record<string, string> = {
  success:           'bg-green-100 text-green-800 border-green-200',
  rejected:          'bg-red-100 text-red-800 border-red-200',
  expired:           'bg-gray-100 text-gray-700 border-gray-200',
  rule_blocked:      'bg-yellow-100 text-yellow-800 border-yellow-200',
  membership_invalid:'bg-red-100 text-red-800 border-red-200',
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

interface Props {
  params: Promise<{ memberId: string }>;
}

export default async function MemberDetailPage({ params }: Props) {
  await requireAdmin();
  const { memberId } = await params;
  const supabase = createServiceClient();

  const { data: membershipData } = await supabase
    .from('consumer_memberships')
    .select('id, profile_id, status, plan_interval, current_period_start, current_period_end, cancel_at_period_end, started_at, stripe_customer_id, stripe_subscription_id, profiles(full_name, email)')
    .eq('id', memberId)
    .single();

  const m = membershipData as any;
  if (!m) {
    return (
      <div>
        <Link href="/members" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">
          ← Members
        </Link>
        <p className="text-gray-500">Member not found.</p>
      </div>
    );
  }

  const { data: redemptionRows } = await supabase
    .from('redemptions')
    .select('id, redeemed_at, status, offers(title), retailers(name)')
    .eq('profile_id', m.profile_id)
    .order('redeemed_at', { ascending: false })
    .limit(50);

  const redemptions = (redemptionRows ?? []) as any[];
  const statusCls = STATUS_CLASSES[m.status] ?? STATUS_CLASSES.inactive;

  const details = [
    { label: 'Plan', value: m.plan_interval ? m.plan_interval.charAt(0).toUpperCase() + m.plan_interval.slice(1) : '—' },
    { label: 'Started', value: fmtDate(m.started_at) },
    { label: 'Period start', value: fmtDate(m.current_period_start) },
    { label: 'Period end', value: fmtDate(m.current_period_end) },
    { label: 'Cancelling', value: m.cancel_at_period_end ? 'Yes' : 'No' },
    { label: 'Stripe customer', value: m.stripe_customer_id ?? '—' },
    { label: 'Stripe subscription', value: m.stripe_subscription_id ?? '—' },
  ];

  return (
    <div>
      <Link href="/members" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">
        ← Members
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{m.profiles?.full_name ?? 'Member'}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{m.profiles?.email ?? '—'}</p>
      </div>

      {/* Membership card */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-base font-semibold text-gray-900">Membership</h2>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${statusCls}`}>
            {m.status.replace('_', ' ')}
          </span>
        </div>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
          {details.map(({ label, value }) => (
            <div key={label}>
              <dt className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</dt>
              <dd className="text-sm text-gray-800 mt-0.5 font-mono break-all">{value}</dd>
            </div>
          ))}
        </dl>

        {m.status !== 'cancelled' && m.status !== 'expired' && (
          <div className="mt-5 pt-5 border-t border-gray-100">
            <form action={cancelMembership}>
              <input type="hidden" name="membership_id" value={m.id} />
              <button
                type="submit"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
              >
                Cancel membership
              </button>
            </form>
            <p className="mt-1 text-xs text-gray-400">
              This immediately marks the membership as cancelled and logs an admin action.
              It does not cancel the Stripe subscription — do that separately in the Stripe dashboard.
            </p>
          </div>
        )}
      </div>

      {/* Redemption history */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Redemption history</h2>
        {redemptions.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400 border border-gray-200 rounded-lg bg-white">
            No redemptions yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Time</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Offer</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Retailer</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {redemptions.map((r: any) => {
                  const cls = REDEMPTION_STATUS_CLASSES[r.status] ?? 'bg-gray-100 text-gray-600 border-gray-200';
                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDateTime(r.redeemed_at)}</td>
                      <td className="px-4 py-3 text-gray-800 max-w-[180px] truncate">{(r.offers as any)?.title ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{(r.retailers as any)?.name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${cls}`}>
                          {r.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
