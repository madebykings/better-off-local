'use client';

import { useState, useTransition } from 'react';
import { saveOpeningHoursForLocation } from '@/lib/actions/opening_hours';
import {
  DAY_KEYS,
  DEFAULT_HOURS,
  type DayKey,
  type OpeningHoursData,
} from '@/lib/utils/opening_hours';

const DAY_LABELS: Record<DayKey, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};

const inputCls = 'rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-700';

interface Props {
  locationId: string;
  initialData: OpeningHoursData;
}

export function OpeningHoursEditor({ locationId, initialData }: Props) {
  const [hours, setHours] = useState<OpeningHoursData>(initialData);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function setDay(day: DayKey, patch: Partial<OpeningHoursData[DayKey]>) {
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));
    setSaved(false);
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await saveOpeningHoursForLocation(locationId, hours);
      if (!result) {
        setSaved(true);
      } else {
        setError(result.error ?? 'Could not save opening hours.');
      }
    });
  }

  // Copy weekday hours to all other weekdays.
  function applyMonToFri() {
    const template = hours.monday;
    const updated = { ...hours };
    (['tuesday', 'wednesday', 'thursday', 'friday'] as DayKey[]).forEach((d) => {
      updated[d] = { ...template };
    });
    setHours(updated);
    setSaved(false);
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {saved && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Opening hours saved.
        </div>
      )}

      <div className="space-y-3">
        {DAY_KEYS.map((day) => {
          const d = hours[day];
          return (
            <div key={day} className="flex items-center gap-3 flex-wrap">
              <div className="w-24 shrink-0">
                <span className="text-sm text-gray-700 font-medium">{DAY_LABELS[day]}</span>
              </div>

              <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={d.open}
                  onChange={(e) => setDay(day, { open: e.target.checked })}
                  className="accent-green-700"
                />
                Open
              </label>

              {d.open && (
                <>
                  <input
                    type="time"
                    value={d.start ?? '09:00'}
                    onChange={(e) => setDay(day, { start: e.target.value, all_day: false })}
                    className={inputCls}
                    disabled={d.all_day}
                  />
                  <span className="text-gray-400 text-sm">to</span>
                  <input
                    type="time"
                    value={d.end ?? '17:00'}
                    onChange={(e) => setDay(day, { end: e.target.value, all_day: false })}
                    className={inputCls}
                    disabled={d.all_day}
                  />
                  <label className="flex items-center gap-1.5 text-sm text-gray-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={d.all_day}
                      onChange={(e) => setDay(day, { all_day: e.target.checked })}
                      className="accent-green-700"
                    />
                    24h
                  </label>
                </>
              )}

              {!d.open && (
                <span className="text-sm text-gray-400">Closed</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 mt-5">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="rounded-lg bg-green-800 px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isPending ? 'Saving…' : 'Save hours'}
        </button>
        <button
          type="button"
          onClick={applyMonToFri}
          className="text-sm text-gray-500 hover:text-gray-700 underline"
        >
          Copy Monday to Tue–Fri
        </button>
      </div>
    </div>
  );
}
