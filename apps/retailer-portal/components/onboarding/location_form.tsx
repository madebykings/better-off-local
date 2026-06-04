'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getPrevStep, getNextStep } from '@/lib/onboarding/steps';
import { saveRetailerLocation, type LocationFields } from '@/lib/actions/location';

// ---------------------------------------------------------------------------
// Address preview
// ---------------------------------------------------------------------------

function AddressPreview({
  addressLine1,
  addressLine2,
  town,
  postcode,
}: {
  addressLine1: string;
  addressLine2: string;
  town: string;
  postcode: string;
}) {
  const hasAny = addressLine1 || town || postcode;

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-[0_2px_20px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.04]">
      {/* Map placeholder */}
      <div className="relative flex h-32 items-center justify-center overflow-hidden bg-gradient-to-br from-stone-100 to-stone-200">
        <svg
          className="h-10 w-10 text-stone-300"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          aria-hidden="true"
        >
          {/* MapPinIcon */}
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
          />
        </svg>
      </div>

      <div className="px-4 py-4">
        {hasAny ? (
          <address className="not-italic">
            <p className="text-[13px] font-semibold leading-snug text-gray-900">
              {addressLine1}
            </p>
            {addressLine2 && (
              <p className="text-[13px] leading-snug text-gray-700">{addressLine2}</p>
            )}
            <p className="text-[13px] leading-snug text-gray-700">
              {town}
            </p>
            {postcode && (
              <p className="text-[13px] leading-snug text-gray-700">
                {postcode.toUpperCase()}
              </p>
            )}
          </address>
        ) : (
          <div className="space-y-1.5">
            <div className="h-3 w-36 rounded bg-gray-100" />
            <div className="h-3 w-24 rounded bg-gray-100" />
            <div className="h-3 w-20 rounded bg-gray-100" />
          </div>
        )}

        <p className="mt-3 flex items-center gap-1 text-[11px] text-gray-400">
          <svg
            className="h-3.5 w-3.5 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
            />
          </svg>
          Serving United Kingdom
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Field component
// ---------------------------------------------------------------------------

function Field({
  label,
  id,
  value,
  onChange,
  placeholder,
  error,
  optional,
  autoComplete,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  optional?: boolean;
  autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
        {optional && (
          <span className="ml-1.5 text-xs font-normal text-gray-400">optional</span>
        )}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={[
          'block w-full rounded-lg border px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-brand/30',
          error
            ? 'border-red-300 bg-red-50 focus:border-red-400'
            : 'border-gray-200 bg-white focus:border-brand',
        ].join(' ')}
      />
      {error && (
        <p className="mt-1 text-xs text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LocationForm
// ---------------------------------------------------------------------------

export function LocationForm({
  initialData,
}: {
  initialData: LocationFields;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [fields, setFields] = useState<LocationFields>(initialData);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof LocationFields, string>>>({});
  const [continueError, setContinueError] = useState<string | null>(null);

  function set(key: keyof LocationFields) {
    return (value: string) => {
      setFields((prev) => ({ ...prev, [key]: value }));
      // Clear field error on change.
      if (fieldErrors[key]) {
        setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
      }
      setContinueError(null);
    };
  }

  function handleBack() {
    const prev = getPrevStep('location');
    router.push(prev?.path ?? '/onboarding');
  }

  function handleContinue() {
    setContinueError(null);
    startTransition(async () => {
      const result = await saveRetailerLocation(fields);

      if (!result) {
        // Success — navigate to next step.
        const next = getNextStep('location');
        if (next) router.push(next.path);
        return;
      }

      if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors);
        return;
      }

      if (result.error) {
        setContinueError(result.error);
        // Do not navigate — revision 4.
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-x-14 gap-y-10 lg:grid-cols-[1fr_280px]">
      {/* ── Form fields ─────────────────────────────────────────────── */}
      <div className="space-y-5">
        <Field
          label="Address line 1"
          id="address-line-1"
          value={fields.addressLine1}
          onChange={set('addressLine1')}
          placeholder="12 Mill Street"
          error={fieldErrors.addressLine1}
          autoComplete="address-line1"
        />

        <Field
          label="Address line 2"
          id="address-line-2"
          value={fields.addressLine2}
          onChange={set('addressLine2')}
          placeholder="Unit 4"
          optional
          autoComplete="address-line2"
        />

        <Field
          label="Town / City"
          id="town"
          value={fields.town}
          onChange={set('town')}
          placeholder="Alloa"
          error={fieldErrors.town}
          autoComplete="address-level2"
        />

        <div className="max-w-[180px]">
          <Field
            label="Postcode"
            id="postcode"
            value={fields.postcode}
            onChange={set('postcode')}
            placeholder="FK10 1AA"
            error={fieldErrors.postcode}
            autoComplete="postal-code"
          />
        </div>

        {/* Country — display only */}
        <div className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
          <svg
            className="h-4 w-4 flex-shrink-0 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
            />
          </svg>
          <span className="text-sm text-gray-500">Serving United Kingdom</span>
        </div>

        {/* Back / Continue */}
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

      {/* ── Live preview ────────────────────────────────────────────── */}
      <aside className="order-first lg:order-none lg:sticky lg:top-6 lg:self-start">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">
          Live preview
        </p>
        <AddressPreview
          addressLine1={fields.addressLine1}
          addressLine2={fields.addressLine2}
          town={fields.town}
          postcode={fields.postcode}
        />
        <p className="mt-2.5 text-center text-[11px] text-gray-400">
          This is how members will see your location.
        </p>
      </aside>
    </div>
  );
}
