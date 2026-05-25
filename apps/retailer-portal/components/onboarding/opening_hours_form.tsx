'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getPrevStep, getNextStep } from '@/lib/onboarding/steps';
import { saveOpeningHours } from '@/lib/actions/opening_hours';
import {
  DAY_KEYS,
  DEFAULT_HOURS,
  type DayKey,
  type DaySchedule,
  type OpeningHoursData,
} from '@/lib/utils/opening_hours';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAY_LABELS: Record<DayKey, string> = {
  monday:    'Mon',
  tuesday:   'Tue',
  wednesday: 'Wed',
  thursday:  'Thu',
  friday:    'Fri',
  saturday:  'Sat',
  sunday:    'Sun',
};

const WEEKDAYS: DayKey[] = ['tuesday', 'wednesday', 'thursday', 'friday'];
const ALL_OTHER_DAYS: DayKey[] = ['tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

// ---------------------------------------------------------------------------
// Internal form state
//
// Uses non-null strings for start/end so <input type="time"> stays controlled.
// Converted back to the OpeningHoursData shape (with nulls) at submit time.
// ---------------------------------------------------------------------------

type DayFormState = {
  open: boolean;
  allDay: boolean;
  start: string; // "HH:MM" or "" — preserved across toggle for UX
  end: string;   // "HH:MM" or "" — preserved across toggle for UX
};

type FormState = Record<DayKey, DayFormState>;

function toFormState(data: OpeningHoursData): FormState {
  return Object.fromEntries(
    DAY_KEYS.map((day) => [
      day,
      {
        open:   data[day].open,
        allDay: data[day].all_day,
        start:  data[day].start ?? '',
        end:    data[day].end   ?? '',
      },
    ]),
  ) as FormState;
}

function toOpeningHoursData(state: FormState): OpeningHoursData {
  return Object.fromEntries(
    DAY_KEYS.map((day) => {
      const { open, allDay, start, end } = state[day];
      return [
        day,
        {
          open,
          all_day: allDay,
          start: open && !allDay ? (start || null) : null,
          end:   open && !allDay ? (end   || null) : null,
        } satisfies DaySchedule,
      ];
    }),
  ) as OpeningHoursData;
}

// ---------------------------------------------------------------------------
// DayRow
// ---------------------------------------------------------------------------

function DayRow({
  day,
  label,
  state,
  error,
  disabled,
  onChange,
}: {
  day: DayKey;
  label: string;
  state: DayFormState;
  error?: string;
  disabled: boolean;
  onChange: (patch: Partial<DayFormState>) => void;
}) {
  const { open, allDay, start, end } = state;

  return (
    <div>
      <div
        className={[
          'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl px-3 py-3 transition-colors',
          open ? 'bg-white' : 'bg-gray-50',
        ].join(' ')}
      >
        {/* Day label */}
        <span className="w-7 text-sm font-semibold text-gray-700">{label}</span>

        {/* Open / Closed toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={open}
          onClick={() => onChange({ open: !open, allDay: false })}
          disabled={disabled}
          className={[
            'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
            open
              ? 'bg-brand text-white'
              : 'bg-gray-200 text-gray-500 hover:bg-gray-300',
          ].join(' ')}
        >
          {open ? 'Open' : 'Closed'}
        </button>

        {open && (
          <>
            {/* All-day checkbox */}
            <label className="flex cursor-pointer select-none items-center gap-1.5 text-xs text-gray-500">
              <input
                type="checkbox"
                checked={allDay}
                onChange={(e) => onChange({ allDay: e.target.checked })}
                disabled={disabled}
                className="h-3.5 w-3.5 rounded border-gray-300 accent-brand"
              />
              All day
            </label>

            {allDay ? (
              <span className="text-xs font-medium text-brand">Open 24 hours</span>
            ) : (
              <div className="flex items-center gap-1.5">
                <input
                  type="time"
                  value={start}
                  onChange={(e) => onChange({ start: e.target.value })}
                  disabled={disabled}
                  className={[
                    'rounded-lg border px-2 py-1 text-sm tabular-nums transition-colors',
                    'focus:outline-none focus:ring-2 focus:ring-brand/30',
                    error
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-200 bg-white focus:border-brand',
                  ].join(' ')}
                />
                <span className="text-xs text-gray-400">–</span>
                <input
                  type="time"
                  value={end}
                  onChange={(e) => onChange({ end: e.target.value })}
                  disabled={disabled}
                  className={[
                    'rounded-lg border px-2 py-1 text-sm tabular-nums transition-colors',
                    'focus:outline-none focus:ring-2 focus:ring-brand/30',
                    error
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-200 bg-white focus:border-brand',
                  ].join(' ')}
                />
              </div>
            )}
          </>
        )}

        {!open && (
          <span className="text-xs text-gray-400">—</span>
        )}
      </div>

      {error && (
        <p className="mt-1 px-3 text-xs text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// OpeningHoursForm
// ---------------------------------------------------------------------------

export function OpeningHoursForm({
  initialData,
}: {
  initialData: OpeningHoursData;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [state, setState] = useState<FormState>(() => toFormState(initialData));
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<DayKey, string>>>({});
  const [continueError, setContinueError] = useState<string | null>(null);

  function setDay(day: DayKey, patch: Partial<DayFormState>) {
    setState((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));
    if (fieldErrors[day]) {
      setFieldErrors((prev) => ({ ...prev, [day]: undefined }));
    }
    setContinueError(null);
  }

  /** Copies Monday's current schedule to the target days. */
  function applyMonday(targets: DayKey[]) {
    const mon = state.monday;
    setState((prev) => {
      const next = { ...prev };
      for (const day of targets) {
        next[day] = { ...mon };
      }
      return next;
    });
    // Clear any field errors on affected days.
    setFieldErrors((prev) => {
      const next = { ...prev };
      for (const day of targets) delete next[day];
      return next;
    });
    setContinueError(null);
  }

  function handleBack() {
    const prev = getPrevStep('opening-hours');
    router.push(prev?.path ?? '/onboarding');
  }

  function handleContinue() {
    setContinueError(null);
    startTransition(async () => {
      const result = await saveOpeningHours(toOpeningHoursData(state));

      if (!result) {
        const next = getNextStep('opening-hours');
        if (next) router.push(next.path);
        return;
      }

      if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors);
        return;
      }

      if (result.error) {
        setContinueError(result.error);
        // Do not navigate on any error — step advance failure included.
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* ── Day rows ──────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        {DAY_KEYS.map((day) => (
          <DayRow
            key={day}
            day={day}
            label={DAY_LABELS[day]}
            state={state[day]}
            error={fieldErrors[day]}
            disabled={isPending}
            onChange={(patch) => setDay(day, patch)}
          />
        ))}
      </div>

      {/* ── Apply Monday's hours ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
        <span className="text-xs text-gray-500">Copy Monday&rsquo;s hours to:</span>
        <button
          type="button"
          onClick={() => applyMonday(WEEKDAYS)}
          disabled={isPending}
          className="text-xs font-medium text-brand underline-offset-2 hover:underline disabled:opacity-50"
        >
          Weekdays (Tue–Fri)
        </button>
        <button
          type="button"
          onClick={() => applyMonday(ALL_OTHER_DAYS)}
          disabled={isPending}
          className="text-xs font-medium text-brand underline-offset-2 hover:underline disabled:opacity-50"
        >
          All days
        </button>
      </div>

      {/* ── Back / Continue ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-6">
        <button
          type="button"
          onClick={handleBack}
          disabled={isPending}
          className="text-sm font-medium text-gray-400 transition-colors hover:text-gray-600 disabled:opacity-50"
        >
          ← Back
        </button>

        <div className="flex flex-col items-end gap-1.5">
          {continueError && (
            <p className="text-xs text-red-500" role="alert">
              {continueError}
            </p>
          )}
          <button
            type="button"
            onClick={handleContinue}
            disabled={isPending}
            className="rounded-lg bg-brand px-6 py-2.5 text-sm font-semibold text-white
                       transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? 'Saving…' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}

export { DEFAULT_HOURS };
