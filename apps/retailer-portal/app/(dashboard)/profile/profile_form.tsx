'use client';

import { useState } from 'react';
import { updateRetailerProfile, type ProfileFields } from '@/lib/actions/profile';
import { ImageUploadZone } from '@/components/onboarding/image_upload_zone';

const LOGO_MAX_BYTES  = 5  * 1024 * 1024;  // 5 MB
const COVER_MAX_BYTES = 10 * 1024 * 1024;  // 10 MB

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

const DESCRIPTION_MAX = 160;

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
  coverUrl,
}: {
  initialData: ProfileFields;
  logoUrl: string | null;
  coverUrl: string | null;
}) {
  const [fields, setFields] = useState<ProfileFields>(initialData);
  const [errors, setErrors] = useState<Partial<Record<keyof ProfileFields, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, setIsPending] = useState(false);

  // Image URLs are managed by ImageUploadZone — saved immediately on upload.
  // We track them in state only to allow the live preview to stay in sync.
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(logoUrl);
  const [currentCoverUrl, setCurrentCoverUrl] = useState<string | null>(coverUrl);

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

  const descCount = fields.description.length;

  return (
    <div className="max-w-xl space-y-8">

      {/* ── Images ───────────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Images
        </h2>
        <p className="mb-4 text-xs text-gray-400">
          Images upload immediately. JPG, PNG, or WebP only.
        </p>

        <div className="space-y-5">
          <ImageUploadZone
            slot="cover"
            label="Cover image"
            aspectHint="Recommended: 1600 × 600 px · max 10 MB · shown at top of your listing"
            maxBytes={COVER_MAX_BYTES}
            currentUrl={currentCoverUrl}
            onUploaded={(url) => setCurrentCoverUrl(url)}
            onRemoved={() => setCurrentCoverUrl(null)}
          />

          <ImageUploadZone
            slot="logo"
            label="Logo"
            aspectHint="Recommended: 400 × 400 px minimum, square · max 5 MB · shown on listing cards and dashboard avatar"
            maxBytes={LOGO_MAX_BYTES}
            currentUrl={currentLogoUrl}
            onUploaded={(url) => setCurrentLogoUrl(url)}
            onRemoved={() => setCurrentLogoUrl(null)}
          />
        </div>
      </section>

      {/* ── Text fields ──────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Listing details
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
            id="tagline"
            label="Tagline"
            hint="Optional — appears on listing cards in the app. One punchy line that tells members what makes you special."
          >
            <input
              id="tagline"
              type="text"
              value={fields.tagline}
              onChange={setField('tagline')}
              maxLength={80}
              placeholder="e.g. Handmade food, made with love"
              className={inputCls(false)}
              disabled={isPending}
            />
          </Field>

          <Field
            id="website"
            label="Website"
            hint="Optional — shown as a link on your listing."
            error={errors.website}
          >
            <input
              id="website"
              type="url"
              value={fields.website}
              onChange={setField('website')}
              placeholder="e.g. https://yoursite.com"
              autoComplete="url"
              className={inputCls(!!errors.website)}
              disabled={isPending}
            />
          </Field>

          <Field
            id="description"
            label="Short description"
            required
            hint="Shown on your listing card and detail page."
            error={errors.description}
          >
            <div className="relative">
              <textarea
                id="description"
                value={fields.description}
                onChange={setField('description')}
                maxLength={DESCRIPTION_MAX}
                rows={3}
                placeholder="Tell members what makes your business worth visiting…"
                className={[inputCls(!!errors.description), 'resize-none leading-relaxed pb-6'].join(' ')}
                disabled={isPending}
              />
              <span
                className={[
                  'pointer-events-none absolute bottom-2.5 right-3 text-[11px] tabular-nums transition-colors',
                  descCount > 130 ? 'text-amber-500' : 'text-gray-300',
                ].join(' ')}
              >
                {descCount}/{DESCRIPTION_MAX}
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
              {BUSINESS_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>

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
