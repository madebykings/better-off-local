import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRetailerUser } from '@/lib/auth/require_retailer_user';
import { createServiceClient } from '@/lib/supabase/service';
import { PageHeader, StatusBadge, EmptyState } from '@better-off-local/ui';

export const metadata: Metadata = { title: 'Stories – Retailer Portal' };

type StoryRow = {
  id: string;
  title: string;
  expires_at: string | null;
  view_count: number;
  created_at: string;
};

function storyStatus(expiresAt: string | null): 'active' | 'expired' {
  if (!expiresAt) return 'active';
  return new Date(expiresAt) > new Date() ? 'active' : 'expired';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default async function StoriesPage() {
  const { retailerId } = await requireRetailerUser();
  const supabase = createServiceClient();

  const { data } = await supabase
    .from('business_stories')
    .select('id, title, expires_at, view_count, created_at')
    .eq('retailer_id', retailerId)
    .order('created_at', { ascending: false });

  const stories: StoryRow[] = data ?? [];

  return (
    <div>
      <PageHeader
        title="Stories"
        description="Share updates with your local community."
        action={
          <Link
            href="/stories/new"
            className="text-sm bg-green-800 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            New story
          </Link>
        }
      />

      {stories.length === 0 ? (
        <EmptyState
          title="No stories yet"
          description="Share an update with your local community."
          action={
            <Link
              href="/stories/new"
              className="text-sm bg-green-800 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              Post your first story
            </Link>
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Title</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Posted</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Expires</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Views</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stories.map((story) => {
                  const status = storyStatus(story.expires_at);
                  return (
                    <tr key={story.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium max-w-[260px] truncate">
                        <Link
                          href={`/stories/${story.id}/edit`}
                          className="text-gray-800 hover:text-green-700 hover:underline"
                        >
                          {story.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={status} />
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {formatDate(story.created_at)}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {story.expires_at ? formatDate(story.expires_at) : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 tabular-nums">
                        {story.view_count.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Link
                          href={`/stories/${story.id}/edit`}
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

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {stories.map((story) => {
              const status = storyStatus(story.expires_at);
              return (
                <div key={story.id} className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/stories/${story.id}/edit`}
                      className="font-medium text-gray-800 hover:text-green-700 min-w-0 truncate block"
                    >
                      {story.title}
                    </Link>
                    <StatusBadge status={status} />
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                    <span>Posted {formatDate(story.created_at)}</span>
                    {story.expires_at && (
                      <span>Expires {formatDate(story.expires_at)}</span>
                    )}
                    <span>{story.view_count.toLocaleString()} views</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
