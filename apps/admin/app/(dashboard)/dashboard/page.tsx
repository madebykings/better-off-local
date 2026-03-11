import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';

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

  const metrics = [
    { label: 'Pending retailers', value: pendingRetailers, href: '/retailers?status=pending', urgent: pendingRetailers > 0, icon: '🏪' },
    { label: 'Pending offers', value: pendingOffers, href: '/offers?status=pending', urgent: pendingOffers > 0, icon: '🏷️' },
    { label: 'Approved retailers', value: approvedRetailers, href: '/retailers', urgent: false, icon: '✅' },
    { label: 'Active members', value: activeMembers, href: '/members', urgent: false, icon: '👥' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Platform health, pending approvals, and recent activity.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-8">
        {metrics.map((m) => (
          <Link key={m.label} href={m.href}
            className={`rounded-lg border p-4 hover:shadow-sm transition-shadow ${m.urgent ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'}`}>
            <div className="text-2xl mb-1">{m.icon}</div>
            <div className={`text-2xl font-bold ${m.urgent ? 'text-amber-700' : 'text-gray-900'}`}>{m.value}</div>
            <div className="text-xs text-gray-500 mt-1">{m.label}</div>
            {m.urgent && <div className="text-xs text-amber-600 font-medium mt-1">Needs attention</div>}
          </Link>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Recent admin actions</h2>
        {recentActions.length === 0 ? (
          <div className="text-center py-10 text-gray-400 border border-gray-200 rounded-lg">
            <p className="text-sm">No admin actions recorded yet</p>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Action</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Table</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Admin</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">When</th>
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
          </div>
        )}
      </div>
    </div>
  );
}
