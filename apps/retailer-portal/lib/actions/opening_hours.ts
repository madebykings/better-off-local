'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

// ---------------------------------------------------------------------------
// Types
//
// The opening_hours_json column on retailer_locations stores this shape.
// This is a stable contract — the Flutter consumer app reads it directly.
//
// Per-day rules:
//   open: false            → business is closed that day
//   open: true, all_day: true   → open 24 hours; start/end are null
//   open: true, all_day: false  → start/end are "HH:MM" (24-hour, zero-padded)
// ---------------------------------------------------------------------------

export const DAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export type DayKey = (typeof DAY_KEYS)[number];

export type DaySchedule = {
  open: boolean;
  all_day: boolean;
  start: string | null; // "HH:MM" or null
  end: string | null;   // "HH:MM" or null
};

export type OpeningHoursData = Record<DayKey, DaySchedule>;

export type OpeningHoursActionResult = {
  error?: string;
  fieldErrors?: Partial<Record<DayKey, string>>;
};

// ---------------------------------------------------------------------------
// Defaults and safe parsing
// ---------------------------------------------------------------------------

export const DEFAULT_HOURS: OpeningHoursData = {
  monday:    { open: true,  all_day: false, start: '09:00', end: '17:00' },
  tuesday:   { open: true,  all_day: false, start: '09:00', end: '17:00' },
  wednesday: { open: true,  all_day: false, start: '09:00', end: '17:00' },
  thursday:  { open: true,  all_day: false, start: '09:00', end: '17:00' },
  friday:    { open: true,  all_day: false, start: '09:00', end: '17:00' },
  saturday:  { open: false, all_day: false, start: null,    end: null    },
  sunday:    { open: false, all_day: false, start: null,    end: null    },
};

/**
 * Safely coerces raw JSONB (returned by Supabase as `unknown`) into a typed
 * OpeningHoursData value. Missing or malformed keys fall back to DEFAULT_HOURS
 * so the form always renders correctly even if the stored JSON predates a
 * schema change (e.g. adding all_day).
 */
export function parseOpeningHours(raw: unknown): OpeningHoursData {
  const result = structuredClone(DEFAULT_HOURS);
  if (!raw || typeof raw !== 'object') return result;

  for (const day of DAY_KEYS) {
    const entry = (raw as Record<string, unknown>)[day];
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    result[day] = {
      open:    typeof e.open    === 'boolean' ? e.open    : false,
      all_day: typeof e.all_day === 'boolean' ? e.all_day : false,
      start:   typeof e.start   === 'string'  ? e.start   : null,
      end:     typeof e.end     === 'string'  ? e.end     : null,
    };
  }

  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getAuthUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect('/sign-in');
  return user.id;
}

async function getRetailerId(userId: string): Promise<string | null> {
  const service = createServiceClient();
  const { data } = await service
    .from('retailer_users')
    .select('retailer_id')
    .eq('profile_id', userId)
    .maybeSingle();
  return data?.retailer_id ?? null;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateHours(hours: OpeningHoursData): OpeningHoursActionResult | null {
  // At least one open day is required during onboarding.
  // Dashboard editing can relax this constraint later.
  const hasOpenDay = DAY_KEYS.some((day) => hours[day].open);
  if (!hasOpenDay) {
    return { error: 'Please mark at least one day as open before continuing.' };
  }

  const fieldErrors: Partial<Record<DayKey, string>> = {};

  for (const day of DAY_KEYS) {
    const { open, all_day, start, end } = hours[day];
    if (!open || all_day) continue;

    if (!start || !end) {
      fieldErrors[day] = 'Please set opening and closing times.';
      continue;
    }
    // "HH:MM" string comparison is correct for zero-padded 24-hour times.
    if (end <= start) {
      fieldErrors[day] = 'Closing time must be after opening time.';
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Save opening hours
// ---------------------------------------------------------------------------

/**
 * Persists opening hours to the primary retailer location's
 * opening_hours_json column.
 *
 * The JSON shape stored here is read directly by the Flutter consumer app.
 * Do not change key names or types without a coordinated app release.
 *
 * Advances onboarding_step to 'links' only if currently on 'opening-hours'.
 * If the step advance fails, returns an error to block navigation — the
 * hours data is already saved at that point.
 *
 * Returns null on success, { error } or { fieldErrors } on failure.
 */
export async function saveOpeningHours(
  hours: OpeningHoursData,
): Promise<OpeningHoursActionResult | null> {
  const validationResult = validateHours(hours);
  if (validationResult) return validationResult;

  const userId = await getAuthUserId();
  const retailerId = await getRetailerId(userId);

  if (!retailerId) {
    return { error: 'No retailer record found. Please complete the previous steps.' };
  }

  const service = createServiceClient();

  // Read current step before mutating.
  const { data: retailer } = await service
    .from('retailers')
    .select('onboarding_step')
    .eq('id', retailerId)
    .single();

  // Locate the primary location — must exist (created during location step).
  const { data: location } = await service
    .from('retailer_locations')
    .select('id')
    .eq('retailer_id', retailerId)
    .eq('is_primary', true)
    .maybeSingle();

  if (!location) {
    return { error: 'No location found. Please complete the location step first.' };
  }

  const { error: updateError } = await service
    .from('retailer_locations')
    .update({ opening_hours_json: hours })
    .eq('id', location.id);

  if (updateError) {
    console.error('[saveOpeningHours] update error:', updateError.message);
    return { error: 'Failed to save opening hours. Please try again.' };
  }

  // Advance step — only if currently on 'opening-hours'.
  // Return an error on failure to block navigation; hours are already saved.
  if (retailer?.onboarding_step === 'opening-hours') {
    const { error: stepError } = await service
      .from('retailers')
      .update({ onboarding_step: 'links', updated_at: new Date().toISOString() })
      .eq('id', retailerId);

    if (stepError) {
      console.error('[saveOpeningHours] step advance error:', stepError.message);
      return {
        error: 'Your hours were saved, but we could not advance to the next step. Please try again.',
      };
    }
  }

  return null;
}
