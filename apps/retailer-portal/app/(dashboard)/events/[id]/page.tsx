import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRetailerUser } from '@/lib/auth/require_retailer_user';
import { createServiceClient } from '@/lib/supabase/service';
import { EventDetailClient } from './event_detail_client';
import type { EventFields } from '@/lib/actions/events';

export const metadata: Metadata = { title: 'Edit Event – Retailer Portal' };

interface Props {
  params: Promise<{ id: string }>;
}

function toDateString(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

function toTimeString(iso: string | null): string {
  if (!iso) return '';
  // Extract HH:MM from ISO string.
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export default async function EventDetailPage({ params }: Props) {
  const { id } = await params;
  const { retailerId } = await requireRetailerUser();
  const supabase = createServiceClient();

  const [eventResult, locationsResult] = await Promise.all([
    supabase
      .from('events')
      .select(
        'id, title, short_summary, description, event_type, start_at, end_at, venue_id, image_url, booking_url, status, review_notes',
      )
      .eq('id', id)
      .eq('retailer_id', retailerId)
      .maybeSingle(),
    supabase
      .from('retailer_locations')
      .select('id, name, address_line_1')
      .eq('retailer_id', retailerId)
      .eq('is_active', true)
      .order('is_primary', { ascending: false }),
  ]);

  if (!eventResult.data) notFound();

  const ev = eventResult.data;

  const initialValues: EventFields = {
    title: ev.title ?? '',
    shortSummary: (ev as any).short_summary ?? '',
    description: (ev as any).description ?? '',
    eventType: (ev as any).event_type ?? '',
    startDate: toDateString((ev as any).start_at),
    startTime: toTimeString((ev as any).start_at),
    endDate: toDateString((ev as any).end_at),
    endTime: toTimeString((ev as any).end_at),
    venueId: (ev as any).venue_id ?? '',
    imageUrl: (ev as any).image_url ?? '',
    bookingUrl: (ev as any).booking_url ?? '',
  };

  const venues = (locationsResult.data ?? []).map((l) => ({
    id: l.id,
    name: l.name ?? '',
    address_line1: l.address_line_1 ?? '',
  }));

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
          <Link href="/events" className="hover:text-gray-600 transition-colors">
            Events
          </Link>
          <span>›</span>
          <span className="text-gray-600 truncate max-w-[240px]">{ev.title}</span>
        </div>
        <h1 className="text-2xl font-semibold">{ev.title}</h1>
      </div>

      <EventDetailClient
        eventId={ev.id}
        initialValues={initialValues}
        status={ev.status}
        reviewNotes={(ev as any).review_notes ?? null}
        venues={venues}
      />
    </div>
  );
}
