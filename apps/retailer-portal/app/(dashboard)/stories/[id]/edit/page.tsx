import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRetailerUser } from '@/lib/auth/require_retailer_user';
import { createServiceClient } from '@/lib/supabase/service';
import { StoryForm } from '@/components/stories/story_form';
import { updateStory } from '../../actions';

export const metadata: Metadata = { title: 'Edit Story – Retailer Portal' };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditStoryPage({ params }: Props) {
  const { id } = await params;
  const { retailerId } = await requireRetailerUser();
  const supabase = createServiceClient();

  const { data: story } = await supabase
    .from('business_stories')
    .select('id, title, content, expires_at')
    .eq('id', id)
    .eq('retailer_id', retailerId)
    .maybeSingle();

  if (!story) notFound();

  const boundUpdate = updateStory.bind(null, story.id);

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
          <Link href="/stories" className="hover:text-gray-600 transition-colors">
            Stories
          </Link>
          <span>›</span>
          <span className="text-gray-600">Edit story</span>
        </div>
        <h1 className="text-2xl font-semibold">Edit story</h1>
        <p className="mt-1 text-sm text-gray-500">
          Update this story for your local community.
        </p>
      </div>
      <StoryForm
        action={boundUpdate}
        initialTitle={story.title}
        initialContent={story.content}
        initialExpiresAt={story.expires_at ?? undefined}
        submitLabel="Save changes"
      />
    </div>
  );
}
