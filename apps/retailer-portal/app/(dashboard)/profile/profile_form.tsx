'use client';

import { useState } from 'react';
import { updateRetailerProfile, type ProfileFields } from '@/lib/actions/profile';
import { ImageUploadZone } from '@/components/onboarding/image_upload_zone';

const LOGO_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

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

function inputCls(hasError: boolean) {
  return [
    'w-full rounded-lg border px-3 py-2.5 text-sm text-gray-900',
    'placeholder:text-gray-400 transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-green-700/20 focus:border-green-700',
    'disabled:bg-gray-50 disabled:text-gray-500',
    hasError ? 'border-red-300 bg-red-50/50' : 'border-gray-200 bg-white',
  ].join(' ');
}

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
        {required && <span className="ml-0.5 text-red-400" aria-hidden="true">*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1.5 text-xs text-gray-400">{hint}</p>}
      {error && <p className="mt-1.5 text-xs text-red-500" role="alert">{error}</p>}
    </div>
  );
}

export function ProfileForm({
  initialData,
  logoUrl,
  categoryNames = [],
}: {
  initialData: ProfileFields;
  logoUrl: string | null;
  categoryNames?: string[];
}) {
  const [fields, setFields] = useState<ProfileFields>(initialData);
  const [errors, setErrors] = useState<Partial<Record<keyof ProfileFields, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(logoUrl);

  function setField(key: keyof ProfileFields) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setFields((prev) => ({ ...prev, [key]: e.target.value }));
      if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
      setSaved(false);
    };
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);
    setSaved(false);
    setIsPending(true);

    try {
      const result = await updateRetailerProfile(fields);
      if (result?.fieldErrors) {
        setErrors(result.fieldErrors);
        return;
      }
      if (result?.error) {
        setServerError(result.error);
        return;
      }
      setSaved(true);
    } finally {
      setIsPending(false);
    }
  }

  const shortDescCount = fields.shortDescription.length;

  return (
    <div className="max-w-xl space-y-8">

      {/* ── Brand logo ───────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Brand logo
        </h2>
        <p className="mb-4 text-xs text-gray-400">
          Your brand logo appears on listing cards and your dashboard. JPG, PNG, or WebP · max 5 MB.
        </p>
        <ImageUploadZone
          slot="logo"
          label="Logo"
          aspectHint="Recommended: 400 × 400 px minimum, square"
          maxBytes={LOGO_MAX_BYTES}
          currentUrl={currentLogoUrl}
          onUploaded={(url) => setCurrentLogoUrl(url)}
          onRemoved={() => setCurrentLogoUrl(null)}
        />
        <p className="mt-3 text-xs text-gray-400">
          Venue cover images and location-specific branding are managed on the{' '}
          <a href="/locations" className="text-green-700 underline">Locations</a> page.
        </p>
      </section>

      {/* ── Brand identity ───────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Brand identity
        </h2>

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          {serverError && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {serverError}
            </div>
          )}
          {saved && (
            <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              Profile saved.
            </div>
          )}

          <Field id="name" label="Business name" required error={errors.name}>
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
            hint="Shown beneath your business name. One or two punchy sentences."
            error={errors.shortDescription}
          >
            <div className="relative">
              <textarea
                id="shortDescription"
                value={fields.shortDescription}
                onChange={setField('shortDescription')}
                maxLength={SHORT_DESC_MAX}
                rows={2}
                placeholder="e.g. A cosy café in the heart of Alloa serving locally sourced food and great coffee."
                className={[inputCls(!!errors.shortDescription), 'resize-none leading-relaxed pb-6'].join(' ')}
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

          <Field id="businessType" label="Business type" required error={errors.businessType}>
            <select
              id="businessType"
              value={fields.businessType}
              onChange={setField('businessType')}
              className={inputCls(!!errors.businessType) + ' cursor-pointer'}
              disabled={isPending}
            >
              <option value="">Select a type…</option>
              {(categoryNames.length > 0 ? categoryNames : BUSINESS_TYPES).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>

          {/* ── Owner / contact details ─────────────────────────────── */}
          <div className="border-t border-gray-100 pt-6">
            <p className="text-sm font-medium text-gray-700 mb-4">Owner / contact details</p>
            <div className="space-y-5">
              <Field id="contactName" label="Contact name" hint="The person members or the Better Off Local team should contact.">
                <input
                  id="contactName"
                  type="text"
                  value={fields.contactName}
                  onChange={setField('contactName')}
                  placeholder="e.g. Jane Smith"
                  autoComplete="name"
                  className={inputCls(false)}
                  disabled={isPending}
                />
              </Field>

              <Field id="phone" label="Contact phone">
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

              <Field id="email" label="Contact email">
                <input
                  id="email"
                  type="email"
                  value={fields.email}
                  onChange={setField('email')}
                  placeholder="e.g. hello@yourbusiness.com"
                  autoComplete="email"
                  className={inputCls(false)}
                  disabled={isPending}
                />
              </Field>
            </div>
          </div>

          <div className="flex items-center gap-4 border-t border-gray-100 pt-6">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-green-800 px-6 py-2.5 text-sm font-semibold text-white
                         transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? 'Saving…' : 'Save changes'}
            </button>
            {saved && (
              <span className="text-sm text-green-700">Saved ✓</span>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
