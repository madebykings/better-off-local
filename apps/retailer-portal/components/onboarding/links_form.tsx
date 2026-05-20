'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getPrevStep, getNextStep } from '@/lib/onboarding/steps';
import { saveRetailerLinks, type LinksFields } from '@/lib/actions/links';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const EMPTY_LINKS: LinksFields = {
  website: '',
  instagram: '',
  facebook: '',
  tiktok: '',
  whatsapp: '',
  phone: '',
  email: '',
  preferredContactType: '',
};

const PREFERRED_OPTIONS = [
  { value: '',          label: 'None' },
  { value: 'phone',     label: 'Phone' },
  { value: 'whatsapp',  label: 'WhatsApp' },
  { value: 'email',     label: 'Email' },
  { value: 'website',   label: 'Website' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook',  label: 'Facebook' },
  { value: 'tiktok',    label: 'TikTok' },
];

// ---------------------------------------------------------------------------
// Icons (Heroicons v2 outline, 24 × 24)
// ---------------------------------------------------------------------------

// GlobeAltIcon
const GLOBE_PATHS = [
  'M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253M3.284 14.253A8.959 8.959 0 013 12c0-1.046.178-2.05.504-2.982',
];
// AtSymbolIcon
const AT_PATHS = [
  'M16.5 12a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zm0 0c0 1.657 1.007 3 2.25 3S21 13.657 21 12a9 9 0 10-2.636 6.364M16.5 12V8.25',
];
// ChatBubbleLeftIcon (WhatsApp)
const CHAT_PATHS = [
  'M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.74v6.018z',
];
// DevicePhoneMobileIcon (phone)
const PHONE_PATHS = [
  'M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 8.25h3v.008h-3V9.75zm0 3h3v.008h-3v-.008zm0 3h3v.008h-3v-.008z',
];
// EnvelopeIcon
const ENVELOPE_PATHS = [
  'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75',
];

function Icon({ paths, className }: { paths: string[]; className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      {paths.map((d, i) => (
        <path key={i} strokeLinecap="round" strokeLinejoin="round" d={d} />
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

const PREVIEW_CONFIG: Record<
  string,
  { label: string; badgeClass: string; displayFn: (v: string) => string }
> = {
  website:   { label: 'Website',   badgeClass: 'bg-blue-50 text-blue-700',    displayFn: (v) => v.replace(/^https?:\/\//, '') },
  instagram: { label: 'Instagram', badgeClass: 'bg-pink-50 text-pink-700',    displayFn: (v) => v.startsWith('@') ? v : `@${v}` },
  facebook:  { label: 'Facebook',  badgeClass: 'bg-indigo-50 text-indigo-700', displayFn: (v) => v.replace(/^@/, '') },
  tiktok:    { label: 'TikTok',    badgeClass: 'bg-gray-900 text-gray-100',   displayFn: (v) => v.startsWith('@') ? v : `@${v}` },
  whatsapp:  { label: 'WhatsApp',  badgeClass: 'bg-green-50 text-green-700',  displayFn: (v) => v },
  phone:     { label: 'Phone',     badgeClass: 'bg-gray-100 text-gray-700',   displayFn: (v) => v },
  email:     { label: 'Email',     badgeClass: 'bg-amber-50 text-amber-700',  displayFn: (v) => v },
};

const PREVIEW_ORDER: (keyof LinksFields)[] = [
  'website', 'instagram', 'facebook', 'tiktok', 'whatsapp', 'phone', 'email',
];

function LinksPreview({ fields }: { fields: LinksFields }) {
  const activeLinks = PREVIEW_ORDER.filter(
    (key) => key !== 'preferredContactType' && fields[key].trim(),
  );

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-[0_2px_20px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.04]">
      <div className="px-4 py-4">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">
          How members see your links
        </p>

        {activeLinks.length === 0 ? (
          <div className="space-y-2 py-2">
            <div className="h-3 w-32 rounded bg-gray-100" />
            <div className="h-3 w-24 rounded bg-gray-100" />
            <div className="h-3 w-28 rounded bg-gray-100" />
          </div>
        ) : (
          <ul className="space-y-2.5">
            {activeLinks.map((key) => {
              const config = PREVIEW_CONFIG[key as string];
              if (!config) return null;
              return (
                <li key={key} className="flex items-center gap-2.5 overflow-hidden">
                  <span
                    className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${config.badgeClass}`}
                  >
                    {config.label}
                  </span>
                  <span className="truncate text-[12px] text-gray-600">
                    {config.displayFn(fields[key])}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {fields.preferredContactType && PREVIEW_CONFIG[fields.preferredContactType] && (
          <p className="mt-3 border-t border-gray-100 pt-3 text-[11px] text-gray-400">
            Preferred contact:{' '}
            <span className="font-medium text-gray-600">
              {PREVIEW_CONFIG[fields.preferredContactType].label}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Field
// ---------------------------------------------------------------------------

function Field({
  label,
  id,
  value,
  onChange,
  placeholder,
  error,
  iconPaths,
  type = 'text',
  autoComplete,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  iconPaths: string[];
  type?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Icon paths={iconPaths} className="h-4 w-4 text-gray-400" />
        </div>
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={[
            'block w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-brand/30',
            error
              ? 'border-red-300 bg-red-50 focus:border-red-400'
              : 'border-gray-200 bg-white focus:border-brand',
          ].join(' ')}
        />
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LinksForm
// ---------------------------------------------------------------------------

export function LinksForm({ initialFields }: { initialFields: LinksFields }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [fields, setFields] = useState<LinksFields>(initialFields);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof LinksFields, string>>
  >({});
  const [continueError, setContinueError] = useState<string | null>(null);

  function set(key: keyof LinksFields) {
    return (value: string) => {
      setFields((prev) => ({ ...prev, [key]: value }));
      if (fieldErrors[key]) {
        setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
      }
      setContinueError(null);
    };
  }

  function handleBack() {
    const prev = getPrevStep('links');
    router.push(prev?.path ?? '/onboarding');
  }

  function handleContinue() {
    setContinueError(null);
    startTransition(async () => {
      const result = await saveRetailerLinks(fields);

      if (!result) {
        const next = getNextStep('links');
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

  const allEmpty = Object.entries(fields)
    .filter(([k]) => k !== 'preferredContactType')
    .every(([, v]) => !v.trim());

  return (
    <div className="grid grid-cols-1 gap-x-14 gap-y-10 lg:grid-cols-[1fr_240px]">
      {/* ── Form ────────────────────────────────────────────────────── */}
      <div className="space-y-8">
        {/* Online presence */}
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            Online presence
          </p>
          <Field
            label="Website"
            id="website"
            value={fields.website}
            onChange={set('website')}
            placeholder="yoursite.com"
            error={fieldErrors.website}
            iconPaths={GLOBE_PATHS}
            autoComplete="url"
          />
          <Field
            label="Instagram"
            id="instagram"
            value={fields.instagram}
            onChange={set('instagram')}
            placeholder="@yourhandle"
            error={fieldErrors.instagram}
            iconPaths={AT_PATHS}
          />
          <Field
            label="Facebook"
            id="facebook"
            value={fields.facebook}
            onChange={set('facebook')}
            placeholder="yourpage"
            error={fieldErrors.facebook}
            iconPaths={AT_PATHS}
          />
          <Field
            label="TikTok"
            id="tiktok"
            value={fields.tiktok}
            onChange={set('tiktok')}
            placeholder="@yourhandle"
            error={fieldErrors.tiktok}
            iconPaths={AT_PATHS}
          />
        </div>

        {/* Contact */}
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            Contact
          </p>
          <Field
            label="WhatsApp"
            id="whatsapp"
            value={fields.whatsapp}
            onChange={set('whatsapp')}
            placeholder="07911 123456"
            error={fieldErrors.whatsapp}
            iconPaths={CHAT_PATHS}
            type="tel"
          />
          <Field
            label="Phone"
            id="phone"
            value={fields.phone}
            onChange={set('phone')}
            placeholder="01259 726000"
            error={fieldErrors.phone}
            iconPaths={PHONE_PATHS}
            type="tel"
            autoComplete="tel"
          />
          <Field
            label="Email"
            id="email"
            value={fields.email}
            onChange={set('email')}
            placeholder="hello@yourbusiness.com"
            error={fieldErrors.email}
            iconPaths={ENVELOPE_PATHS}
            type="email"
            autoComplete="email"
          />
        </div>

        {/* Preferred contact */}
        <div className="space-y-2">
          <label
            htmlFor="preferred-contact"
            className="block text-sm font-medium text-gray-700"
          >
            Preferred contact method
            <span className="ml-1.5 text-xs font-normal text-gray-400">optional</span>
          </label>
          <p className="text-xs text-gray-500">
            Shown as the primary action button on your listing.
          </p>
          <select
            id="preferred-contact"
            value={fields.preferredContactType}
            onChange={(e) => set('preferredContactType')(e.target.value)}
            disabled={isPending}
            className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900
                       focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          >
            {PREFERRED_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Soft nudge — not a blocking error */}
        {allEmpty && (
          <p className="text-[12px] text-amber-600">
            No contact info added yet — you can update this any time from your dashboard.
          </p>
        )}

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

      {/* ── Live preview ─────────────────────────────────────────────── */}
      <aside className="order-first lg:order-none lg:sticky lg:top-6 lg:self-start">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">
          Live preview
        </p>
        <LinksPreview fields={fields} />
        <p className="mt-2.5 text-center text-[11px] text-gray-400">
          This is how members will see your links.
        </p>
      </aside>
    </div>
  );
}
