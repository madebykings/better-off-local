import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';
import { MetricCard, PageHeader, SectionCard, EmptyState } from '@better-off-local/ui';

export const metadata: Metadata = { title: 'Dashboard – Admin' };

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export default async function DashboardPage() {
  await requireAdmin();
  const supabase = createServiceClient();

  const [
    pendingRetailersResult,
    pendingOffersResult,
    totalRetailersResult,
    totalMembersResult,
    recentActionsResult,
  ] = await Promise.all([
    supabase.from('retailers').select('id', { count: 'exact', head: true }).eq('approval_status', 'pending'),
    supabase.from('offers').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('retailers').select('id', { count: 'exact', head: true }).eq('approval_status', 'approved'),
    supabase.from('consumer_memberships').select('id', { count: 'exact', head: true }).in('status', ['active', 'trialing']),
    supabase
      .from('admin_actions')
      .select('id, action_type, target_table, target_id, created_at, profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const pendingRetailers = pendingRetailersResult.count ?? 0;
  const pendingOffers = pendingOffersResult.count ?? 0;
  const approvedRetailers = totalRetailersResult.count ?? 0;
  const activeMembers = totalMembersResult.count ?? 0;
  const recentActions = recentActionsResult.data ?? [];

  function StoreIcon() {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016 2.993 2.993 0 0 0 2.25-1.016 3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
      </svg>
    );
  }
  function TagIcon() {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
      </svg>
    );
  }
  function UsersIcon() {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
      </svg>
    );
  }

  const metrics = [
    { label: 'Pending retailers', value: pendingRetailers, href: '/retailers?status=pending', urgent: pendingRetailers > 0, icon: <StoreIcon /> },
    { label: 'Pending offers', value: pendingOffers, href: '/offers?status=pending', urgent: pendingOffers > 0, icon: <TagIcon /> },
    { label: 'Approved retailers', value: approvedRetailers, href: '/retailers', urgent: false, icon: <StoreIcon /> },
    { label: 'Active members', value: activeMembers, href: '/members', urgent: false, icon: <UsersIcon /> },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Platform health, pending approvals, and recent activity."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-8">
        {metrics.map((m) => (
          <MetricCard
            key={m.label}
            label={m.label}
            value={m.value}
            icon={m.icon}
            href={m.href}
            urgent={m.urgent}
          />
        ))}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Recent admin actions</h2>
        {recentActions.length === 0 ? (
          <EmptyState
            title="No admin actions recorded yet"
          />
        ) : (
          <SectionCard padding={false}>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Action</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Table</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Admin</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentActions.map((a: any) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{a.action_type}</td>
                    <td className="px-4 py-3 text-gray-500">{a.target_table}</td>
                    <td className="px-4 py-3 text-gray-600">{a.profiles?.full_name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{formatDate(a.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
