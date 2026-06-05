import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRetailerUser } from '@/lib/auth/require_retailer_user';
import { StoryForm } from '@/components/stories/story_form';
import { createStory } from '../actions';

export const metadata: Metadata = { title: 'New Story – Retailer Portal' };

export default async function NewStoryPage() {
  await requireRetailerUser();

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
          <Link href="/stories" className="hover:text-gray-600 transition-colors">
            Stories
          </Link>
          <span>›</span>
          <span className="text-gray-600">New story</span>
        </div>
        <h1 className="text-2xl font-semibold">Post a story</h1>
        <p className="mt-1 text-sm text-gray-500">
          Share a short update with members in your local community.
        </p>
      </div>
      <StoryForm action={createStory} />
    </div>
  );
}
