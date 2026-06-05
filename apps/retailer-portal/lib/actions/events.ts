'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EventFields = {
  title: string;
  shortSummary: string;
  description: string;
  eventType: string;
  startDate: string;   // ISO date (YYYY-MM-DD)
  startTime: string;   // HH:MM
  endDate: string;
  endTime: string;
  venueId: string;     // retailer_location id, or empty string for no specific venue
  imageUrl: string;
  bookingUrl: string;
};

export type EventActionResult = {
  error?: string;
  fieldErrors?: Partial<Record<keyof EventFields, string>>;
};

export type CreateEventResult = { eventId: string } | EventActionResult;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateEvent(fields: EventFields): Partial<Record<keyof EventFields, string>> {
  const errors: Partial<Record<keyof EventFields, string>> = {};

  if (!fields.title.trim()) {
    errors.title = 'Please enter a title for the event.';
  }

  if (!fields.startDate) {
    errors.startDate = 'Please select a start date.';
  } else if (!fields.startTime) {
    errors.startTime = 'Please select a start time.';
  } else {
    const startAt = new Date(`${fields.startDate}T${fields.startTime}`);
    if (isNaN(startAt.getTime())) {
      errors.startDate = 'Invalid start date or time.';
    } else if (startAt <= new Date()) {
      errors.startDate = 'Start date and time must be in the future.';
    }
  }

  if (!fields.eventType.trim()) {
    errors.eventType = 'Please select an event type.';
  }

  if (fields.endDate && fields.startDate && fields.endDate < fields.startDate) {
    errors.endDate = 'End date must be on or after the start date.';
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

async function getEventCtx(): Promise<{
  userId: string;
  retailerId: string;
  regionId: string | null;
} | null> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect('/sign-in');

  const service = createServiceClient();

  const { data: retailerUser } = await service
    .from('retailer_users')
    .select('retailer_id')
    .eq('profile_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (!retailerUser) return null;

  // Fetch region_id from the retailer's primary location.
  const { data: primaryLocation } = await service
    .from('retailer_locations')
    .select('region_id')
    .eq('retailer_id', retailerUser.retailer_id)
    .eq('is_primary', true)
    .maybeSingle();

  // Fall back to any active location if no primary is set.
  let regionId = primaryLocation?.region_id ?? null;
  if (!regionId) {
    const { data: anyLocation } = await service
      .from('retailer_locations')
      .select('region_id')
      .eq('retailer_id', retailerUser.retailer_id)
      .eq('is_active', true)
      .not('region_id', 'is', null)
      .limit(1)
      .maybeSingle();
    regionId = anyLocation?.region_id ?? null;
  }

  return {
    userId: user.id,
    retailerId: retailerUser.retailer_id,
    regionId,
  };
}

function buildStartAt(date: string, time: string): string {
  return new Date(`${date}T${time}`).toISOString();
}

function buildEndAt(date: string, time: string): string | null {
  if (!date) return null;
  const t = time || '23:59';
  const d = new Date(`${date}T${t}`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createEvent(fields: EventFields): Promise<CreateEventResult> {
  const fieldErrors = validateEvent(fields);
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const ctx = await getEventCtx();
  if (!ctx) return { error: 'No retailer account found.' };

  if (!ctx.regionId) {
    return { error: 'Could not determine your region. Please ensure your business has at least one active location with a region assigned.' };
  }

  const service = createServiceClient();

  const { data: event, error } = await service
    .from('events')
    .insert({
      retailer_id: ctx.retailerId,
      region_id: ctx.regionId,
      venue_id: fields.venueId.trim() || null,
      title: fields.title.trim(),
      short_summary: fields.shortSummary.trim() || null,
      description: fields.description.trim() || null,
      event_type: fields.eventType,
      start_at: buildStartAt(fields.startDate, fields.startTime),
      end_at: buildEndAt(fields.endDate, fields.endTime),
      image_url: fields.imageUrl.trim() || null,
      booking_url: fields.bookingUrl.trim() || null,
      status: 'draft',
    })
    .select('id')
    .single();

  if (error || !event) {
    console.error('[createEvent] insert error:', error?.message);
    return { error: 'Failed to create event. Please try again.' };
  }

  revalidatePath('/events');
  return { eventId: event.id };
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateEvent(
  id: string,
  fields: EventFields,
): Promise<EventActionResult> {
  const fieldErrors = validateEvent(fields);
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const ctx = await getEventCtx();
  if (!ctx) return { error: 'No retailer account found.' };

  const service = createServiceClient();

  // Verify ownership.
  const { data: existing } = await service
    .from('events')
    .select('id, status')
    .eq('id', id)
    .eq('retailer_id', ctx.retailerId)
    .maybeSingle();

  if (!existing) return { error: 'Event not found.' };

  const { error } = await service
    .from('events')
    .update({
      venue_id: fields.venueId.trim() || null,
      title: fields.title.trim(),
      short_summary: fields.shortSummary.trim() || null,
      description: fields.description.trim() || null,
      event_type: fields.eventType,
      start_at: buildStartAt(fields.startDate, fields.startTime),
      end_at: buildEndAt(fields.endDate, fields.endTime),
      image_url: fields.imageUrl.trim() || null,
      booking_url: fields.bookingUrl.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    console.error('[updateEvent] error:', error.message);
    return { error: 'Failed to save event. Please try again.' };
  }

  revalidatePath(`/events/${id}`);
  revalidatePath('/events');
  return {};
}

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------

export async function submitEventForReview(id: string): Promise<{ error?: string }> {
  const ctx = await getEventCtx();
  if (!ctx) return { error: 'No retailer account found.' };

  const service = createServiceClient();

  const { data: event } = await service
    .from('events')
    .select('status')
    .eq('id', id)
    .eq('retailer_id', ctx.retailerId)
    .maybeSingle();

  if (!event) return { error: 'Event not found.' };
  if (!['draft', 'rejected'].includes(event.status)) {
    return { error: 'Only draft or rejected events can be submitted for review.' };
  }

  await service
    .from('events')
    .update({ status: 'pending', updated_at: new Date().toISOString() })
    .eq('id', id);

  revalidatePath(`/events/${id}`);
  revalidatePath('/events');
  return {};
}

export async function saveEventAsDraft(id: string): Promise<{ error?: string }> {
  const ctx = await getEventCtx();
  if (!ctx) return { error: 'No retailer account found.' };

  const service = createServiceClient();

  const { data: event } = await service
    .from('events')
    .select('id')
    .eq('id', id)
    .eq('retailer_id', ctx.retailerId)
    .maybeSingle();

  if (!event) return { error: 'Event not found.' };

  await service
    .from('events')
    .update({ status: 'draft', updated_at: new Date().toISOString() })
    .eq('id', id);

  revalidatePath(`/events/${id}`);
  revalidatePath('/events');
  return {};
}

export async function archiveEvent(id: string): Promise<{ error?: string }> {
  const ctx = await getEventCtx();
  if (!ctx) return { error: 'No retailer account found.' };

  const service = createServiceClient();

  const { data: event } = await service
    .from('events')
    .select('status')
    .eq('id', id)
    .eq('retailer_id', ctx.retailerId)
    .maybeSingle();

  if (!event) return { error: 'Event not found.' };

  await service
    .from('events')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', id);

  revalidatePath('/events');
  redirect('/events');
}
