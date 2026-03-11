import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';
import { RetailerModerationActions } from '@/components/moderation/moderation_actions';
import {
  approveRetailer,
  rejectRetailer,
  suspendRetailer,
  setRetailerVisibility,
} from '@/lib/actions/moderation';

export const metadata: Metadata = { title: 'Retailer – Admin' };

interface Props {
  params: Promise<{ retailerId: string }>;
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900">{value || <span className="text-gray-400">—</span>}</dd>
    </div>
  );
}

export default async function RetailerDetailPage({ params }: Props) {
  await requireAdmin();
  const { retailerId } = await params;
  const supabase = createServiceClient();

  const [retailerResult, locationsResult, subscriptionResult, offersResult, actionsResult] =
    await Promise.all([
      supabase
        .from('retailers')
        .select('*')
        .eq('id', retailerId)
        .single(),
      supabase
        .from('retailer_locations')
        .select('id, name, address_line_1, town, postcode, is_primary, is_active')
        .eq('retailer_id', retailerId),
      supabase
        .from('retailer_subscriptions')
        .select('status, plan_interval, current_period_end')
        .eq('retailer_id', retailerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('offers')
        .select('id, title, status, created_at')
        .eq('retailer_id', retailerId)
        .order('created_at', { ascending: false }),
      supabase
        .from('admin_actions')
        .select('id, action_type, reason, created_at, profiles(full_name)')
        .eq('target_table', 'retailers')
        .eq('target_id', retailerId)
        .order('created_at', { ascending: false }),
    ]);

  if (!retailerResult.data) notFound();
  const r = retailerResult.data;
  const locations = locationsResult.data ?? [];
  const subscription = subscriptionResult.data;
  const offers = offersResult.data ?? [];
  const actions = actionsResult.data ?? [];

  const APPROVAL_CLASSES: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800 border-amber-200',
    approved: 'bg-green-100 text-green-800 border-green-200',
    rejected: 'bg-red-100 text-red-800 border-red-200',
    suspended: 'bg-gray-200 text-gray-700 border-gray-300',
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/retailers" className="text-sm text-gray-500 hover:text-gray-700">← Retailers</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-semibold">{r.name}</h1>
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${APPROVAL_CLASSES[r.approval_status]}`}>
          {r.approval_status}
        </span>
      </div>

      {/* Moderation actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Moderation actions</h2>
        <RetailerModerationActions
          retailerId={r.id}
          currentApprovalStatus={r.approval_status}
          approveAction={approveRetailer}
          rejectAction={rejectRetailer}
          suspendAction={suspendRetailer}
          setVisibilityAction={setRetailerVisibility}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Core details */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Details</h2>
          <dl className="grid grid-cols-2 gap-3">
            <Field label="Approval" value={r.approval_status} />
            <Field label="Visibility" value={r.visibility_status} />
            <Field label="Active" value={r.is_active ? 'Yes' : 'No'} />
            <Field label="Slug" value={r.slug} />
            <Field label="Email" value={r.email} />
            <Field label="Phone" value={r.phone} />
            <Field label="Website" value={r.website_url} />
            <Field label="Created" value={new Date(r.created_at).toLocaleDateString('en-GB')} />
          </dl>
          {r.short_description && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Description</p>
              <p className="text-sm text-gray-700">{r.short_description}</p>
            </div>
          )}
        </div>

        {/* Subscription */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Subscription</h2>
          {subscription ? (
            <dl className="grid grid-cols-2 gap-3">
              <Field label="Status" value={subscription.status} />
              <Field label="Interval" value={subscription.plan_interval} />
              <Field label="Period end"
                value={subscription.current_period_end
                  ? new Date(subscription.current_period_end).toLocaleDateString('en-GB')
                  : null} />
            </dl>
          ) : (
            <p className="text-sm text-gray-400">No subscription found</p>
          )}
          <div className="mt-4 pt-3 border-t border-gray-100">
            <h3 className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">Locations ({locations.length})</h3>
            {locations.length === 0 ? (
              <p className="text-sm text-gray-400">No locations</p>
            ) : (
              <ul className="space-y-1">
                {locations.map((l) => (
                  <li key={l.id} className="text-sm text-gray-700">
                    {[l.address_line_1, l.town, l.postcode].filter(Boolean).join(', ')}
                    {l.is_primary && <span className="ml-1 text-xs text-blue-600">primary</span>}
                    {!l.is_active && <span className="ml-1 text-xs text-red-500">inactive</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Offers */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Offers ({offers.length})</h2>
        {offers.length === 0 ? (
          <p className="text-sm text-gray-400">No offers</p>
        ) : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              {offers.map((o) => (
                <tr key={o.id}>
                  <td className="py-2 text-gray-900 font-medium">{o.title}</td>
                  <td className="py-2 text-gray-500 capitalize">{o.status}</td>
                  <td className="py-2 text-right">
                    <Link href={`/offers/${o.id}`} className="text-xs text-green-700 hover:underline">Review →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Admin action history */}
      {actions.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Admin history</h2>
          <ul className="space-y-2">
            {actions.map((a: any) => (
              <li key={a.id} className="text-sm text-gray-600 flex gap-2">
                <span className="font-mono text-xs bg-gray-100 px-1 rounded">{a.action_type}</span>
                {a.reason && <span className="text-gray-500">— {a.reason}</span>}
                <span className="text-gray-400 ml-auto whitespace-nowrap">
                  {new Date(a.created_at).toLocaleDateString('en-GB')} by {a.profiles?.full_name ?? '—'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
