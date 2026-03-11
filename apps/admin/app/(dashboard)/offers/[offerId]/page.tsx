import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';
import { OfferModerationActions } from '@/components/moderation/moderation_actions';
import {
  approveOffer,
  rejectOffer,
  pauseOffer,
  reinstateOffer,
} from '@/lib/actions/moderation';

export const metadata: Metadata = { title: 'Offer – Admin' };

interface Props {
  params: Promise<{ offerId: string }>;
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900">{value || <span className="text-gray-400">—</span>}</dd>
    </div>
  );
}

const STATUS_BADGES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  live: 'bg-green-100 text-green-800 border-green-200',
  approved: 'bg-blue-100 text-blue-800 border-blue-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  paused: 'bg-orange-100 text-orange-700 border-orange-200',
  draft: 'bg-gray-100 text-gray-600 border-gray-200',
  expired: 'bg-gray-200 text-gray-500 border-gray-300',
};

export default async function OfferDetailPage({ params }: Props) {
  await requireAdmin();
  const { offerId } = await params;
  const supabase = createServiceClient();

  const [offerResult, rulesResult, actionsResult] = await Promise.all([
    supabase
      .from('offers')
      .select('*, retailers(id, name, approval_status, visibility_status)')
      .eq('id', offerId)
      .single(),
    supabase
      .from('offer_rules')
      .select('max_redemptions_per_user, max_redemptions_per_day, max_redemptions_total')
      .eq('offer_id', offerId)
      .maybeSingle(),
    supabase
      .from('admin_actions')
      .select('id, action_type, reason, created_at, profiles(full_name)')
      .eq('target_table', 'offers')
      .eq('target_id', offerId)
      .order('created_at', { ascending: false }),
  ]);

  if (!offerResult.data) notFound();
  const o = offerResult.data;
  const rules = rulesResult.data;
  const actions = actionsResult.data ?? [];

  function formatDate(iso: string | null) {
    return iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/offers" className="text-sm text-gray-500 hover:text-gray-700">← Offers</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-semibold truncate">{o.title}</h1>
        <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${STATUS_BADGES[o.status] ?? ''}`}>
          {o.status}
        </span>
      </div>

      {/* Moderation actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Moderation actions</h2>
        <OfferModerationActions
          offerId={o.id}
          currentStatus={o.status}
          approveAction={approveOffer}
          rejectAction={rejectOffer}
          pauseAction={pauseOffer}
          reinstateAction={reinstateOffer}
        />
      </div>

      {/* Retailer context */}
      {o.retailers && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-sm">
          <span className="font-medium text-amber-800">Retailer: </span>
          <Link href={`/retailers/${o.retailers.id}`} className="text-amber-700 hover:underline">
            {o.retailers.name}
          </Link>
          <span className="ml-3 text-amber-600">
            ({o.retailers.approval_status} / {o.retailers.visibility_status})
          </span>
          {o.retailers.approval_status !== 'approved' && (
            <span className="ml-2 text-red-600 font-medium">⚠ Retailer not approved — offer cannot go live</span>
          )}
        </div>
      )}

      {/* Offer details */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Offer details</h2>
        <dl className="grid grid-cols-2 gap-3">
          <Field label="Type" value={o.offer_type} />
          <Field label="Value" value={o.value_text} />
          <Field label="Start date" value={formatDate(o.start_at)} />
          <Field label="End date" value={formatDate(o.end_at)} />
          <Field label="Approval required" value={o.approval_required ? 'Yes' : 'No'} />
          <Field label="Featured" value={o.is_featured ? 'Yes' : 'No'} />
        </dl>
        {o.short_summary && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <Field label="Summary" value={o.short_summary} />
          </div>
        )}
        {o.terms_text && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <Field label="Terms" value={o.terms_text} />
          </div>
        )}
        {rules && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">Redemption rules</p>
            <dl className="grid grid-cols-3 gap-3">
              <Field label="Per user" value={rules.max_redemptions_per_user?.toString()} />
              <Field label="Per day" value={rules.max_redemptions_per_day?.toString()} />
              <Field label="Total cap" value={rules.max_redemptions_total?.toString()} />
            </dl>
          </div>
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
