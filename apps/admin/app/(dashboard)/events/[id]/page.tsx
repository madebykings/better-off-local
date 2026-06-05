import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';
import { EventModerationActions } from '@/components/moderation/event_moderation_actions';
import {
  approveEvent,
  rejectEvent,
  pauseEvent,
  archiveEvent,
  featureEvent,
} from '@/lib/actions/events';
import { TabbedPanel } from '@better-off-local/ui';

export const metadata: Metadata = { title: 'Event – Admin' };

interface Props {
  params: Promise<{ id: string }>;
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
  pending:  'bg-amber-100 text-amber-800 border-amber-200',
  live:     'bg-green-100 text-green-800 border-green-200',
  paused:   'bg-orange-100 text-orange-700 border-orange-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  archived: 'bg-gray-200 text-gray-500 border-gray-300',
  draft:    'bg-gray-100 text-gray-600 border-gray-200',
};

function formatDateTime(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default async function EventDetailPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: event } = await supabase
    .from('events')
    .select(`
      *,
      retailers ( id, name, approval_status ),
      retailer_locations ( id, name, address_line_1 )
    `)
    .eq('id', id)
    .single();

  if (!event) notFound();

  const e = event as any;

  const reviewTabContent = (
    <div className="space-y-6">
      {e.image_url && (
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={e.image_url}
            alt={e.title ?? 'Event image'}
            className="w-full max-h-64 object-cover rounded-lg border border-gray-200"
          />
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Moderation actions</h2>
        <EventModerationActions
          eventId={e.id}
          currentStatus={e.status}
          isFeatured={!!e.is_featured}
          approveAction={approveEvent}
          rejectAction={rejectEvent}
          pauseAction={pauseEvent}
          archiveAction={archiveEvent}
          featureAction={featureEvent}
        />
      </div>

      {e.review_notes && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm">
          <span className="font-medium text-amber-800">Review notes: </span>
          <span className="text-amber-700">{e.review_notes}</span>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Key details</h2>
        <dl className="grid grid-cols-2 gap-3">
          <Field label="Type" value={e.event_type} />
          <Field label="Featured" value={e.is_featured ? 'Yes' : 'No'} />
          <Field label="Start" value={formatDateTime(e.start_at)} />
          <Field label="End" value={formatDateTime(e.end_at)} />
        </dl>
        {e.summary && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <Field label="Summary" value={e.summary} />
          </div>
        )}
      </div>
    </div>
  );

  const detailsTabContent = (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Event details</h2>
        <dl className="grid grid-cols-2 gap-3">
          <Field label="Type" value={e.event_type} />
          <Field label="Featured" value={e.is_featured ? 'Yes' : 'No'} />
          <Field label="Start" value={formatDateTime(e.start_at)} />
          <Field label="End" value={formatDateTime(e.end_at)} />
        </dl>

        {e.venue_id && e.retailer_locations && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <Field
              label="Venue"
              value={[e.retailer_locations.name, e.retailer_locations.address_line_1].filter(Boolean).join(' — ')}
            />
          </div>
        )}

        {e.summary && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <Field label="Summary" value={e.summary} />
          </div>
        )}

        {e.description && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <dt className="text-xs text-gray-500 font-medium uppercase tracking-wide">Description</dt>
            <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{e.description}</dd>
          </div>
        )}

        {e.booking_url && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <dt className="text-xs text-gray-500 font-medium uppercase tracking-wide">Booking URL</dt>
            <dd className="mt-1 text-sm">
              <a href={e.booking_url} target="_blank" rel="noopener noreferrer" className="text-green-700 hover:underline break-all">
                {e.booking_url}
              </a>
            </dd>
          </div>
        )}
      </div>
    </div>
  );

  const retailerTabContent = (
    <div className="space-y-4">
      {e.retailers ? (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Retailer</p>
          <Link href={`/retailers/${e.retailers.id}`} className="text-sm font-semibold text-green-700 hover:underline">
            {e.retailers.name}
          </Link>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${e.retailers.approval_status === 'approved' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
              {e.retailers.approval_status}
            </span>
            {e.retailers.approval_status !== 'approved' && (
              <span className="text-red-600 text-xs font-medium">⚠ Retailer not approved</span>
            )}
          </div>
          {e.venue_id && e.retailer_locations && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Venue</p>
              <p className="text-sm text-gray-700">
                {[e.retailer_locations.name, e.retailer_locations.address_line_1].filter(Boolean).join(' — ')}
              </p>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-500">No retailer linked to this event.</p>
      )}
    </div>
  );

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <Link href="/events" className="text-sm text-gray-500 hover:text-gray-700">&#8592; Events</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-semibold truncate">{e.title}</h1>
        <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${STATUS_BADGES[e.status] ?? ''}`}>
          {e.status}
        </span>
      </div>

      <TabbedPanel
        tabs={[
          { id: 'review', label: 'Review' },
          { id: 'details', label: 'Details' },
          { id: 'retailer', label: 'Retailer' },
        ]}
        panels={[
          { id: 'review', content: reviewTabContent },
          { id: 'details', content: detailsTabContent },
          { id: 'retailer', content: retailerTabContent },
        ]}
        defaultTab="review"
      />
    </div>
  );
}
