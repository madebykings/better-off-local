'use client';

import { useState } from 'react';
import { updateVenue, type VenueFields } from '@/lib/actions/location';

export type RegionOption = { id: string; name: string };

function inputCls(hasError: boolean) {
  return [
    'block w-full rounded-lg border px-3 py-2.5 text-sm text-gray-900',
    'placeholder:text-gray-400 transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-green-700/30',
    hasError
      ? 'border-red-300 bg-red-50 focus:border-red-400'
      : 'border-gray-200 bg-white focus:border-green-700',
  ].join(' ');
}

function Field({
  label,
  id,
  value,
  onChange,
  placeholder,
  error,
  optional,
  autoComplete,
  type = 'text',
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  optional?: boolean;
  autoComplete?: string;
  type?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
        {optional && <span className="ml-1.5 text-xs font-normal text-gray-400">optional</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={inputCls(!!error)}
      />
      {error && <p className="mt-1 text-xs text-red-500" role="alert">{error}</p>}
    </div>
  );
}

const DESC_MAX = 500;

function ReviewStatusBanner({ status, notes }: { status: string; notes: string | null }) {
  if (status === 'approved') {
    return (
      <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
        Listing approved — your venue is live on the platform.
      </div>
    );
  }
  if (status === 'pending') {
    return (
      <div role="status" className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
        Changes submitted for review. Your venue details will update once approved.
      </div>
    );
  }
  if (status === 'rejected') {
    return (
      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm">
        <p className="font-medium text-red-800">Venue changes rejected</p>
        {notes && <p className="mt-1 text-xs text-red-700">{notes}</p>}
        <p className="mt-1.5 text-xs text-red-600">Update your details below and save to resubmit for review.</p>
      </div>
    );
  }
  // draft
  return (
    <div role="status" className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
      Draft — save your details to submit for review.
    </div>
  );
}

export function VenueForm({
  locationId,
  initialData,
  regions = [],
  reviewStatus = 'draft',
  reviewNotes = null,
}: {
  locationId: string;
  initialData: VenueFields;
  regions?: RegionOption[];
  reviewStatus?: string;
  reviewNotes?: string | null;
}) {
  const [fields, setFields] = useState<VenueFields>(initialData);
  const [errors, setErrors] = useState<Partial<Record<keyof VenueFields, string>>>({});
  const descCount = fields.description.length;
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, setIsPending] = useState(false);

  function set(key: keyof VenueFields) {
    return (value: string) => {
      setFields((prev) => ({ ...prev, [key]: value }));
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
      const result = await updateVenue(locationId, fields);
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

  const saveLabel = (() => {
    if (isPending) return 'Saving…';
    if (reviewStatus === 'draft' || reviewStatus === 'rejected') return 'Save and submit for review';
    return 'Save changes';
  })();

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-xl space-y-5">
      <ReviewStatusBanner status={reviewStatus} notes={reviewNotes} />
      {serverError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {serverError}
        </div>
      )}
      {saved && (
        <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Venue saved.
        </div>
      )}

      <Field
        label="Venue name"
        id="venue-name"
        value={fields.name}
        onChange={set('name')}
        placeholder='e.g. "High Street Branch" or "Main Store"'
        error={errors.name}
        autoComplete="organization"
      />

      {regions.length > 0 && (
        <div>
          <label htmlFor="venue-region" className="mb-1.5 block text-sm font-medium text-gray-700">
            Region <span className="text-red-400 ml-0.5">*</span>
          </label>
          <select
            id="venue-region"
            value={fields.regionId}
            onChange={(e) => {
              setFields((prev) => ({ ...prev, regionId: e.target.value }));
              if (errors.regionId) setErrors((prev) => ({ ...prev, regionId: undefined }));
              setSaved(false);
            }}
            className={inputCls(!!errors.regionId) + ' cursor-pointer'}
          >
            <option value="">Select region…</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          {errors.regionId && <p className="mt-1 text-xs text-red-500" role="alert">{errors.regionId}</p>}
          <p className="mt-1.5 text-xs text-gray-400">
            The area this venue is in. Used to determine when billing applies.
          </p>
        </div>
      )}

      <Field
        label="Address line 1"
        id="address-line-1"
        value={fields.addressLine1}
        onChange={set('addressLine1')}
        placeholder="12 Mill Street"
        error={errors.addressLine1}
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

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Town / City"
          id="town"
          value={fields.town}
          onChange={set('town')}
          placeholder="Alloa"
          error={errors.town}
          autoComplete="address-level2"
        />
        <Field
          label="County"
          id="county"
          value={fields.county}
          onChange={set('county')}
          placeholder="Clackmannanshire"
          optional
          autoComplete="address-level1"
        />
      </div>

      <div className="max-w-[180px]">
        <Field
          label="Postcode"
          id="postcode"
          value={fields.postcode}
          onChange={set('postcode')}
          placeholder="FK10 1AA"
          error={errors.postcode}
          autoComplete="postal-code"
        />
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
        <span className="text-sm text-gray-500">🇬🇧 Serving United Kingdom</span>
      </div>

      {/* ── Venue public content ────────────────────────────────────────── */}
      <div className="border-t border-gray-100 pt-5 space-y-5">
        <p className="text-sm font-medium text-gray-700">Venue listing content</p>

        <Field
          label="Short description"
          id="venue-short-desc"
          value={fields.shortDescription}
          onChange={set('shortDescription')}
          placeholder="A cosy café in the heart of Alloa…"
          optional
        />

        <div>
          <label htmlFor="venue-description" className="mb-1.5 block text-sm font-medium text-gray-700">
            Full description <span className="ml-1.5 text-xs font-normal text-gray-400">optional</span>
          </label>
          <div className="relative">
            <textarea
              id="venue-description"
              value={fields.description}
              onChange={(e) => {
                set('description')(e.target.value);
              }}
              rows={4}
              maxLength={DESC_MAX}
              placeholder="Tell members what makes this venue worth visiting…"
              className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-green-700/30 focus:border-green-700 pb-6"
            />
            <span className={[
              'pointer-events-none absolute bottom-2.5 right-3 text-xs tabular-nums',
              descCount > 450 ? 'text-amber-500' : 'text-gray-300',
            ].join(' ')}>
              {descCount}/{DESC_MAX}
            </span>
          </div>
        </div>

        <Field
          label="Venue phone"
          id="venue-phone"
          value={fields.phone}
          onChange={set('phone')}
          placeholder="e.g. 01259 123456"
          optional
          type="tel"
          autoComplete="tel"
        />

        <Field
          label="Venue website"
          id="venue-website"
          value={fields.websiteUrl}
          onChange={set('websiteUrl')}
          placeholder="https://yoursite.com"
          optional
          type="url"
          autoComplete="url"
        />
      </div>

      <div className="flex items-center gap-4 border-t border-gray-100 pt-5">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-green-800 px-6 py-2.5 text-sm font-semibold text-white
                     transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saveLabel}
        </button>
        {saved && <span className="text-sm text-green-700">Saved ✓</span>}
      </div>
    </form>
  );
}
