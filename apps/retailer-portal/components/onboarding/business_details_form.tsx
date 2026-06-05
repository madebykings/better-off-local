'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getNextStep, getPrevStep } from '@/lib/onboarding/steps';
import {
  saveBusinessDetails,
  draftSaveBusinessDetails,
  type BusinessDetailsFields,
} from '@/lib/actions/onboarding';
import { PARTNER_TYPE_OPTIONS, getPartnerTerms } from '@/lib/partner_type';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BUSINESS_TYPES = [
  'Food & Drink',
  'Retail & Shopping',
  'Health & Beauty',
  'Fitness & Wellness',
  'Services & Trades',
  'Arts & Culture',
  'Hospitality & Tourism',
  'Professional Services',
  'Other',
] as const;

const SHORT_DESC_MAX = 160;
const AUTOSAVE_DELAY_MS = 12_000; // 12 seconds

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

type FormErrors = Partial<Record<keyof BusinessDetailsFields, string>>;

function validate(fields: BusinessDetailsFields): FormErrors {
  const errors: FormErrors = {};
  if (fields.name.trim().length < 2) {
    errors.name = 'Name is required (at least 2 characters).';
  }
  if (fields.shortDescription.trim().length < 10) {
    errors.shortDescription = 'Short description must be at least 10 characters.';
  }
  if (!fields.businessType) {
    errors.businessType = 'Please select a business type.';
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Shared input class helpers
// ---------------------------------------------------------------------------

function inputCls(hasError: boolean) {
  return [
    'w-full rounded-lg border px-3 py-2.5 text-sm text-gray-900',
    'placeholder:text-gray-400 transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand',
    'disabled:bg-gray-50 disabled:text-gray-500',
    hasError ? 'border-red-300 bg-red-50/50' : 'border-gray-200 bg-white',
  ].join(' ');
}

// ---------------------------------------------------------------------------
// Field wrapper
// ---------------------------------------------------------------------------

function Field({
  id,
  label,
  required,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
        {required && (
          <span className="ml-0.5 text-red-400" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && <p className="mt-1.5 text-xs text-gray-400">{hint}</p>}
      {error && (
        <p className="mt-1.5 text-xs text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Live preview card — mirrors the consumer app's retailer card aesthetic
// ---------------------------------------------------------------------------

function RetailerCardPreview({ fields }: { fields: BusinessDetailsFields }) {
  const hasName = fields.name.trim().length > 0;
  const hasDesc = (fields.shortDescription ?? '').trim().length > 0;

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-[0_2px_20px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.04]">
      {/* Cover image placeholder */}
      <div className="relative h-28 bg-gradient-to-br from-stone-100 to-stone-200">
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            className="h-9 w-9 text-stone-300"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 3h18M3 21h18"
            />
          </svg>
        </div>
      </div>

      <div className="px-4 pb-5">
        {/* Logo chip */}
        <div className="-mt-5 mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow ring-1 ring-black/[0.06]">
          <svg
            className="h-5 w-5 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z"
            />
          </svg>
        </div>

        {/* Category badge */}
        {fields.businessType ? (
          <span className="mb-2 inline-block rounded-full bg-brand/[0.08] px-2.5 py-0.5 text-[11px] font-semibold text-brand">
            {fields.businessType}
          </span>
        ) : (
          <div className="mb-2 h-4 w-24 rounded-full bg-gray-100" />
        )}

        {/* Business name */}
        {hasName ? (
          <p className="text-[15px] font-semibold leading-snug text-gray-900">
            {fields.name}
          </p>
        ) : (
          <div className="h-4 w-40 rounded bg-gray-100" />
        )}

        {/* Short description */}
        <div className="mt-2.5">
          {hasDesc ? (
            <p className="line-clamp-3 text-[13px] leading-relaxed text-gray-500">
              {fields.shortDescription}
            </p>
          ) : (
            <div className="space-y-1.5">
              <div className="h-2.5 w-full rounded bg-gray-100" />
              <div className="h-2.5 w-4/5 rounded bg-gray-100" />
              <div className="h-2.5 w-3/5 rounded bg-gray-100" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main form component
// ---------------------------------------------------------------------------

export function BusinessDetailsForm({
  initialData,
}: {
  initialData: BusinessDetailsFields;
}) {
  const router = useRouter();

  const [fields, setFields] = useState<BusinessDetailsFields>(initialData);
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  // Autosave state
  const isDirtyRef = useRef(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  // Keep a stable ref to the latest fields for the autosave callback.
  const fieldsRef = useRef(fields);
  useEffect(() => {
    fieldsRef.current = fields;
  });

  function scheduleAutosave() {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(async () => {
      await draftSaveBusinessDetails(fieldsRef.current);
      setSavedAt(new Date());
      isDirtyRef.current = false;
    }, AUTOSAVE_DELAY_MS);
  }

  // Cancel any pending autosave on unmount.
  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, []);

  function setField(key: keyof BusinessDetailsFields) {
    return (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => {
      setFields((prev) => ({ ...prev, [key]: e.target.value }));
      // Clear per-field error as soon as the user edits it.
      if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
      // Mark dirty and schedule autosave.
      isDirtyRef.current = true;
      setSavedAt(null);
      scheduleAutosave();
    };
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);

    const clientErrors = validate(fields);
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      const firstKey = Object.keys(clientErrors)[0];
      document.getElementById(firstKey)?.focus();
      return;
    }

    // Cancel pending autosave — the full save takes over.
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    isDirtyRef.current = false;

    setIsPending(true);
    try {
      const result = await saveBusinessDetails(fields);
      if (result?.fieldErrors) {
        setErrors(result.fieldErrors);
        return;
      }
      if (result?.error) {
        setServerError(result.error);
        return;
      }

      // Success — advance to the next step.
      const next = getNextStep('business-details');
      if (next) router.push(next.path);
    } finally {
      setIsPending(false);
    }
  }

  function handleBack() {
    const prev = getPrevStep('business-details');
    router.push(prev?.path ?? '/dashboard');
  }

  const shortDescCount = (fields.shortDescription ?? '').length;
  const terms = getPartnerTerms(fields.partnerType);

  return (
    <div className="grid grid-cols-1 gap-x-14 gap-y-10 lg:grid-cols-[1fr_320px]">
      {/* ── Form ──────────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {serverError && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {serverError}
          </div>
        )}

        <Field id="partnerType" label="What type of organisation are you?" required>
          <select
            id="partnerType"
            value={fields.partnerType}
            onChange={setField('partnerType')}
            className={inputCls(false) + ' cursor-pointer'}
            disabled={isPending}
          >
            <option value="">Select a type…</option>
            {PARTNER_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>

        <Field id="name" label={`${terms.entity} name`} required error={errors.name}>
          <input
            id="name"
            type="text"
            value={fields.name}
            onChange={setField('name')}
            placeholder="e.g. Stirling Street Deli"
            autoComplete="organization"
            className={inputCls(!!errors.name)}
            disabled={isPending}
          />
        </Field>

        <Field
          id="shortDescription"
          label="Short description"
          required
          hint="Shown directly beneath your name in the app. One or two sentences that tell members what makes you special."
          error={errors.shortDescription}
        >
          <div className="relative">
            <textarea
              id="shortDescription"
              value={fields.shortDescription}
              onChange={setField('shortDescription')}
              maxLength={SHORT_DESC_MAX}
              rows={3}
              placeholder="e.g. A cosy café in the heart of Alloa serving locally sourced food and great coffee."
              className={[
                inputCls(!!errors.shortDescription),
                'resize-none leading-relaxed pb-6',
              ].join(' ')}
              disabled={isPending}
            />
            <span
              className={[
                'pointer-events-none absolute bottom-2.5 right-3 text-[11px] tabular-nums transition-colors',
                shortDescCount > 130 ? 'text-amber-500' : 'text-gray-300',
              ].join(' ')}
            >
              {shortDescCount}/{SHORT_DESC_MAX}
            </span>
          </div>
        </Field>

        <Field
          id="businessType"
          label="Business type"
          required
          error={errors.businessType}
        >
          <select
            id="businessType"
            value={fields.businessType}
            onChange={setField('businessType')}
            className={inputCls(!!errors.businessType) + ' cursor-pointer'}
            disabled={isPending}
          >
            <option value="">Select a type…</option>
            {BUSINESS_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>

        {/* TODO: Deprecate this phone field. The Links onboarding step (step 6)
            now owns phone, email, and WhatsApp contact details. Hide this field
            once the links step is live for all retailers. Do not remove the DB
            column (retailers.phone) as existing records may have data here. */}
        <Field
          id="phone"
          label="Phone number"
          hint="Optional — shown on your listing so members can call directly."
        >
          <input
            id="phone"
            type="tel"
            value={fields.phone}
            onChange={setField('phone')}
            placeholder="e.g. 01259 123456"
            autoComplete="tel"
            className={inputCls(false)}
            disabled={isPending}
          />
        </Field>

        {/* ── Back / Continue ───────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-t border-gray-100 pt-6">
          <button
            type="button"
            onClick={handleBack}
            className="text-sm font-medium text-gray-400 transition-colors hover:text-gray-600"
          >
            ← Back
          </button>

          <div className="flex items-center gap-3">
            {savedAt && (
              <span className="text-xs text-gray-400">Saved just now</span>
            )}
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-brand px-6 py-2.5 text-sm font-semibold text-white
                         transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? 'Saving…' : 'Continue'}
            </button>
          </div>
        </div>
      </form>

      {/* ── Live preview ──────────────────────────────────────────────── */}
      {/*
        On mobile: preview appears above the form (order-first) so users see
        what they're building before filling fields in.
        On desktop: preview is sticky on the right, updating as you type.
      */}
      <aside className="order-first lg:order-none lg:sticky lg:top-6 lg:self-start">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">
          Live preview
        </p>
        <RetailerCardPreview fields={fields} />
        <p className="mt-2.5 text-center text-[11px] text-gray-400">
          This is how members will see your listing.
        </p>
      </aside>
    </div>
  );
}
