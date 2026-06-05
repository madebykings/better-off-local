'use server';

import { redirect } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/service';
import { requireRetailerUser } from '@/lib/auth/require_retailer_user';

export async function createStory(formData: FormData) {
  const { retailerId } = await requireRetailerUser();
  const supabase = createServiceClient();

  const title = String(formData.get('title') ?? '').trim();
  const content = String(formData.get('content') ?? '').trim();
  const expiresAtRaw = String(formData.get('expires_at') ?? '').trim();
  const notifyFollowers = formData.get('notify_followers') === 'on';

  if (!title || !content) return;

  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw).toISOString() : null;

  await supabase.from('business_stories').insert({
    retailer_id: retailerId,
    title,
    content,
    expires_at: expiresAt,
    notify_followers: notifyFollowers,
  });

  redirect('/stories');
}
