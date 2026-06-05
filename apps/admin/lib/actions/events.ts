'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';

// ─── Admin-only event moderation actions ──────────────────────────────────────

export async function approveEvent(eventId: string, note?: string): Promise<{ error?: string }> {
  try {
    const { userId } = await requireAdmin();
    void userId;
    const supabase = createServiceClient();

    const { error } = await supabase
      .from('events')
      .update({
        status: 'live',
        review_notes: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', eventId);

    if (error) return { error: error.message };

    revalidatePath('/events');
    revalidatePath('/events/' + eventId);
    return {};
  } catch {
    return { error: 'Unauthorized' };
  }
}

export async function rejectEvent(eventId: string, note: string): Promise<{ error?: string }> {
  if (!note?.trim()) return { error: 'A rejection reason is required.' };

  try {
    const { userId } = await requireAdmin();
    void userId;
    const supabase = createServiceClient();

    const { error } = await supabase
      .from('events')
      .update({
        status: 'rejected',
        review_notes: note.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', eventId);

    if (error) return { error: error.message };

    revalidatePath('/events');
    revalidatePath('/events/' + eventId);
    return {};
  } catch {
    return { error: 'Unauthorized' };
  }
}

export async function pauseEvent(eventId: string, reason?: string): Promise<{ error?: string }> {
  try {
    const { userId } = await requireAdmin();
    void userId;
    const supabase = createServiceClient();

    const { error } = await supabase
      .from('events')
      .update({
        status: 'paused',
        ...(reason ? { review_notes: reason } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', eventId);

    if (error) return { error: error.message };

    revalidatePath('/events');
    revalidatePath('/events/' + eventId);
    return {};
  } catch {
    return { error: 'Unauthorized' };
  }
}

export async function archiveEvent(eventId: string): Promise<{ error?: string }> {
  try {
    const { userId } = await requireAdmin();
    void userId;
    const supabase = createServiceClient();

    const { error } = await supabase
      .from('events')
      .update({
        status: 'archived',
        updated_at: new Date().toISOString(),
      })
      .eq('id', eventId);

    if (error) return { error: error.message };

    revalidatePath('/events');
    revalidatePath('/events/' + eventId);
    return {};
  } catch {
    return { error: 'Unauthorized' };
  }
}

export async function featureEvent(eventId: string, featured: boolean): Promise<{ error?: string }> {
  try {
    const { userId } = await requireAdmin();
    void userId;
    const supabase = createServiceClient();

    const { error } = await supabase
      .from('events')
      .update({
        is_featured: featured,
        updated_at: new Date().toISOString(),
      })
      .eq('id', eventId);

    if (error) return { error: error.message };

    revalidatePath('/events');
    revalidatePath('/events/' + eventId);
    return {};
  } catch {
    return { error: 'Unauthorized' };
  }
}
