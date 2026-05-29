import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';

export const metadata: Metadata = { title: 'Subscriptions – Admin' };

const CONSUMER_STATUS_CLASSES: Record<string, string> = {
  active:   'bg-green-100 text-green-800 border-green-200',
  trialing: 'bg-blue-100 text-blue-800 border-blue-200',
  past_due: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  cancelled:'bg-red-100 text-red-800 border-red-200',
  expired:  'bg-gray-100 text-gray-700 border-gray-200',
  inactive: 'bg-gray-100 text-gray-500 border-gray-200',
};

const RETAILER_STATUS_CLASSES: Record<string, string> = {
  active:    'bg-green-100 text-green-800 border-green-200',
  past_due:  'bg-yellow-100 text-yellow-800 border-yellow-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
  expired:   'bg-gray-100 text-gray-700 border-gray-200',
  inactive:  'bg-gray-100 text-gray-500 border-gray-200',
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default async function SubscriptionsPage() {
  await requireAdmin();
  const supabase = createServiceClient();

  const [consumerResult, retailerResult] = await Promise.all([
    supabase
      .from('consumer_memberships')
      .select('id, status, plan_interval, current_period_end, stripe_subscription_id, profiles(full_name, email)')
      .in('status', ['active', 'trialing', 'past_due'])
      .order('current_period_end', { ascending: false })
      .limit(200),
    supabase
      .from('retailer_subscriptions')
      .select('id, status, billing_interval, current_period_end, stripe_subscription_id, retailers(name)')
      .in('status', ['active', 'past_due'])
      .order('current_period_end', { ascending: false })
      .limit(200),
  ]);

  const consumers = (consumerResult.data ?? []) as any[];
  const retailers = (retailerResult.data ?? []) as any[];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Subscriptions</h1>
        <p className="mt-1 text-sm text-gray-500">
          Active billing subscriptions for consumers and retailers.
        </p>
      </div>

      {/* Consumer memberships */}
      <div className="mb-8">
        <h2 className="text-base font-semibold text-gray-800 mb-3">
          Consumer memberships — active ({consumers.length})
        </h2>
        {consumers.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">No active consumer memberships.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Member</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Plan</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Renews</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Stripe ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {consumers.map((c: any) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="text-gray-800">{c.profiles?.full_name ?? '—'}</div>
                      <div className="text-xs text-gray-400">{c.profiles?.email ?? ''}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${CONSUMER_STATUS_CLASSES[c.status] ?? ''}`}>
                        {c.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{c.plan_interval ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{fmtDate(c.current_period_end)}</td>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs truncate max-w-[160px]">
                      {c.stripe_subscription_id ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Retailer subscriptions */}
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-3">
          Retailer subscriptions — active ({retailers.length})
        </h2>
        {retailers.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">No active retailer subscriptions.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Retailer</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Billing</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Renews</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Stripe ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {retailers.map((r: any) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{r.retailers?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${RETAILER_STATUS_CLASSES[r.status] ?? ''}`}>
                        {r.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{r.billing_interval ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{fmtDate(r.current_period_end)}</td>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs truncate max-w-[160px]">
                      {r.stripe_subscription_id ?? '—'}
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
