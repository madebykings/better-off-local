import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRetailerUser } from '@/lib/auth/require_retailer_user';
import { createServiceClient } from '@/lib/supabase/service';

export const metadata: Metadata = { title: 'Events – Retailer Portal' };

type EventRow = {
  id: string;
  title: string;
  status: string;
  start_at: string;
  end_at: string | null;
  venue_id: string | null;
};

type LocationMap = Record<string, string>;

const STATUS_LABELS: Record<string, { label: string; classes: string }> = {
  live:     { label: 'Live',     classes: 'bg-green-100 text-green-800 border-green-200' },
  draft:    { label: 'Draft',    classes: 'bg-gray-100 text-gray-700 border-gray-200' },
  pending:  { label: 'Pending',  classes: 'bg-amber-100 text-amber-800 border-amber-200' },
  paused:   { label: 'Paused',   classes: 'bg-orange-100 text-orange-800 border-orange-200' },
  rejected: { label: 'Rejected', classes: 'bg-red-100 text-red-800 border-red-200' },
  archived: { label: 'Archived', classes: 'bg-gray-100 text-gray-500 border-gray-200' },
};

type Tab = 'upcoming' | 'draft' | 'pending' | 'live' | 'past';

const TABS: { id: Tab; label: string }[] = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'draft',    label: 'Draft' },
  { id: 'pending',  label: 'Pending' },
  { id: 'live',     label: 'Live' },
  { id: 'past',     label: 'Past' },
];

const EMPTY_MESSAGES: Record<Tab, string> = {
  upcoming: 'No upcoming events. Create an event to get started.',
  draft:    'No draft events.',
  pending:  'No events waiting for approval.',
  live:     'No live events right now.',
  past:     'No past events.',
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function filterForTab(events: EventRow[], tab: Tab): EventRow[] {
  const now = new Date();
  switch (tab) {
    case 'upcoming':
      return events.filter(
        (e) => e.status === 'live' && new Date(e.start_at) >= now,
      );
    case 'draft':
      return events.filter((e) => e.status === 'draft');
    case 'pending':
      return events.filter((e) => e.status === 'pending');
    case 'live':
      return events.filter((e) => e.status === 'live');
    case 'past':
      return events.filter(
        (e) =>
          (e.status === 'live' && new Date(e.start_at) < now) ||
          e.status === 'archived',
      );
    default:
      return [];
  }
}

interface Props {
  searchParams: Promise<{ tab?: string }>;
}

export default async function EventsPage({ searchParams }: Props) {
  const { tab: tabParam } = await searchParams;
  const activeTab: Tab = (TABS.some((t) => t.id === tabParam) ? tabParam : 'upcoming') as Tab;

  const { retailerId } = await requireRetailerUser();
  const supabase = createServiceClient();

  const [eventsResult, locationsResult] = await Promise.all([
    supabase
      .from('events')
      .select('id, title, status, start_at, end_at, venue_id')
      .eq('retailer_id', retailerId)
      .order('start_at', { ascending: false }),
    supabase
      .from('retailer_locations')
      .select('id, name')
      .eq('retailer_id', retailerId),
  ]);

  const allEvents: EventRow[] = eventsResult.data ?? [];
  const locationMap: LocationMap = {};
  for (const loc of locationsResult.data ?? []) {
    locationMap[loc.id] = loc.name ?? loc.id;
  }

  const visibleEvents = filterForTab(allEvents, activeTab);

  const tabCounts: Record<Tab, number> = {
    upcoming: filterForTab(allEvents, 'upcoming').length,
    draft:    filterForTab(allEvents, 'draft').length,
    pending:  filterForTab(allEvents, 'pending').length,
    live:     filterForTab(allEvents, 'live').length,
    past:     filterForTab(allEvents, 'past').length,
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Events</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your events and submit them for review.
          </p>
        </div>
        <Link
          href="/events/new"
          className="text-sm bg-green-800 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
        >
          Create event
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {TABS.map((tab) => {
          const count = tabCounts[tab.id];
          return (
            <Link
              key={tab.id}
              href={`/events?tab=${tab.id}`}
              className={[
                'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
                activeTab === tab.id
                  ? 'border-green-700 text-green-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              ].join(' ')}
            >
              {tab.label}
              {count > 0 && (
                <span
                  className={[
                    'ml-2 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold min-w-[1.25rem]',
                    activeTab === tab.id
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500',
                  ].join(' ')}
                >
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Content */}
      {visibleEvents.length === 0 ? (
        <div className="text-center py-16 text-gray-400 border border-gray-200 rounded-lg">
          <p className="text-3xl mb-3">📅</p>
          <p className="font-medium text-gray-600">{EMPTY_MESSAGES[activeTab]}</p>
          {activeTab === 'upcoming' && (
            <p className="text-sm mt-2">
              <Link href="/events/new" className="text-green-700 hover:underline">
                Create your first event
              </Link>
            </p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Title</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Venue</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibleEvents.map((ev) => {
                const badge = STATUS_LABELS[ev.status] ?? {
                  label: ev.status,
                  classes: 'bg-gray-100 text-gray-600 border-gray-200',
                };
                const venueName = ev.venue_id
                  ? (locationMap[ev.venue_id] ?? 'Unknown venue')
                  : '—';
                return (
                  <tr key={ev.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium max-w-[220px] truncate">
                      <Link
                        href={`/events/${ev.id}`}
                        className="text-gray-800 hover:text-green-700 hover:underline"
                      >
                        {ev.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {formatDateTime(ev.start_at)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-[160px] truncate">
                      {venueName}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${badge.classes}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link
                        href={`/events/${ev.id}`}
                        className="text-xs font-medium text-green-700 hover:text-green-900 hover:underline"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
