import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRetailerUser } from '@/lib/auth/require_retailer_user';
import { createServiceClient } from '@/lib/supabase/service';
import { NewEventClient } from './new_event_client';

export const metadata: Metadata = { title: 'New Event – Retailer Portal' };

export default async function NewEventPage() {
  const { retailerId } = await requireRetailerUser();
  const supabase = createServiceClient();

  const { data: locations } = await supabase
    .from('retailer_locations')
    .select('id, name, address_line_1')
    .eq('retailer_id', retailerId)
    .eq('is_active', true)
    .order('is_primary', { ascending: false });

  const venues = (locations ?? []).map((l) => ({
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
          <span className="text-gray-600">New event</span>
        </div>
        <h1 className="text-2xl font-semibold">Create event</h1>
        <p className="mt-1 text-sm text-gray-500">
          New events are saved as drafts. Submit for review when ready.
        </p>
      </div>
      <NewEventClient venues={venues} />
    </div>
  );
}
