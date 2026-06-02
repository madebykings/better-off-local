// ---------------------------------------------------------------------------
// Opening hours utilities
//
// Pure data helpers — no 'use server' directive.
// The opening_hours_json column on retailer_locations stores this shape.
// This is a stable contract — the Flutter consumer app reads it directly.
//
// Per-day rules:
//   open: false                  → business is closed that day
//   open: true, all_day: true    → open 24 hours; start/end are null
//   open: true, all_day: false   → start/end are "HH:MM" (24-hour, zero-padded)
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
