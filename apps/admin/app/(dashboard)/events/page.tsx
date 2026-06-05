import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';
import { PageHeader, StatusBadge, EmptyState } from '@better-off-local/ui';

export const metadata: Metadata = { title: 'Events – Admin' };

interface Props {
  searchParams: Promise<{ status?: string; q?: string }>;
}

const EVENT_TYPE_CLASSES: Record<string, string> = {
  music:     'bg-purple-100 text-purple-700',
  food:      'bg-yellow-100 text-yellow-700',
  sport:     'bg-blue-100 text-blue-700',
  community: 'bg-teal-100 text-teal-700',
  arts:      'bg-pink-100 text-pink-700',
  other:     'bg-gray-100 text-gray-600',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const TABS = [
  { key: 'pending',  label: 'Pending'  },
  { key: 'live',     label: 'Live'     },
  { key: 'paused',   label: 'Paused'   },
  { key: 'rejected', label: 'Rejected' },
  { key: 'archived', label: 'Archived' },
  { key: 'all',      label: 'All'      },
];

export default async function EventsPage({ searchParams }: Props) {
  await requireAdmin();
  const { status, q } = await searchParams;
  const activeTab = status ?? 'pending';
  const supabase = createServiceClient();

  const { count: pendingCount } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  let query = supabase
    .from('events')
    .select(`
      id,
      title,
      status,
      event_type,
      start_at,
      is_featured,
      retailers ( id, name ),
      retailer_locations ( id, name )
    `)
    .order('created_at', { ascending: false });

  if (activeTab !== 'all') {
    query = query.eq('status', activeTab);
  }

  const { data: events } = await query;

  const filtered = (events ?? []).filter((e) =>
    q ? (e.title ?? '').toLowerCase().includes(q.toLowerCase()) : true,
  );

  return (
    <div>
      <PageHeader
        title="Events"
        description="Approve, reject, pause, or archive events submitted by retailers."
      />

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 flex-wrap">
          {TABS.map((tab) => (
            <Link
              key={tab.key}
              href={`/events${tab.key === 'pending' ? '' : `?status=${tab.key}`}`}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors capitalize flex items-center gap-1.5 ${
                activeTab === tab.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {tab.key === 'pending' && (pendingCount ?? 0) > 0 && (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold leading-none">
                  {pendingCount}
                </span>
              )}
            </Link>
          ))}
        </div>

        <form method="GET">
          {status && <input type="hidden" name="status" value={status} />}
          <input
            type="search"
            name="q"
            defaultValue={q ?? ''}
            placeholder="Search by title…"
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-700"
          />
        </form>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="📅"
          title="No events found"
          description={activeTab === 'pending' ? 'No events awaiting review.' : 'Nothing matches your filter.'}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Title</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Retailer</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Venue</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((e: any) => (
                  <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">
                      {e.title}
                      {e.is_featured && (
                        <span className="ml-1.5 text-amber-500 text-xs" title="Featured">&#9733;</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {e.retailers ? (
                        <Link href={`/retailers/${e.retailers.id}`} className="text-green-700 hover:underline text-xs">
                          {e.retailers.name}
                        </Link>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {e.retailer_locations?.name ?? <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {e.start_at ? formatDate(e.start_at) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${EVENT_TYPE_CLASSES[e.event_type] ?? EVENT_TYPE_CLASSES.other}`}>
                        {(e.event_type ?? 'other').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={e.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/events/${e.id}`} className="text-sm text-green-700 hover:text-green-900 font-medium">
                        Review →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((e: any) => (
              <div key={e.id} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-gray-900 min-w-0 truncate">
                    {e.title}
                    {e.is_featured && <span className="ml-1 text-amber-500 text-xs">★</span>}
                  </p>
                  <Link href={`/events/${e.id}`} className="shrink-0 text-sm font-medium text-green-700">
                    Review →
                  </Link>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <StatusBadge status={e.status} />
                  {e.event_type && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${EVENT_TYPE_CLASSES[e.event_type] ?? EVENT_TYPE_CLASSES.other}`}>
                      {e.event_type.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
                <div className="mt-2 text-xs text-gray-400 space-y-0.5">
                  {e.retailers && <p>{e.retailers.name}</p>}
                  {e.start_at && <p>{formatDate(e.start_at)}</p>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
