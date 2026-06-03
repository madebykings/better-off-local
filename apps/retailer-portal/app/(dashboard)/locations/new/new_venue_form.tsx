'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createVenue, type VenueFields } from '@/lib/actions/location';

type RegionWithStats = {
  id: string;
  name: string;
  member_threshold: number;
  active_member_count: number;
};

const DESC_MAX = 500;

const EMPTY: VenueFields = {
  name:             '',
  regionId:         '',
  addressLine1:     '',
  addressLine2:     '',
  town:             '',
  county:           '',
  postcode:         '',
  phone:            '',
  websiteUrl:       '',
  shortDescription: '',
  description:      '',
};

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
  label, id, value, onChange, placeholder, error, optional, autoComplete, required,
}: {
  label: string; id: string; value: string; onChange: (v: string) => void;
  placeholder?: string; error?: string; optional?: boolean; autoComplete?: string; required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-red-400">*</span>}
        {optional && <span className="ml-1.5 text-xs font-normal text-gray-400">optional</span>}
      </label>
      <input
        id={id} type="text" value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} autoComplete={autoComplete}
        className={inputCls(!!error)}
      />
      {error && <p className="mt-1 text-xs text-red-500" role="alert">{error}</p>}
    </div>
  );
}

function RegionStatusBadge({ region }: { region: RegionWithStats }) {
  const isGrowth = region.active_member_count < region.member_threshold;
  const pct = Math.min(100, Math.round((region.active_member_count / Math.max(region.member_threshold, 1)) * 100));

  if (isGrowth) {
    return (
      <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
        <p className="text-sm font-medium text-blue-800">🌱 Growth region — no charge yet</p>
        <p className="text-xs text-blue-600 mt-1">
          {region.name} has {region.active_member_count} of {region.member_threshold} active members.
          This venue will be free until the threshold is reached.
        </p>
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1 h-1 rounded-full bg-blue-100 overflow-hidden">
            <div className="h-full rounded-full bg-blue-400" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs text-blue-500 tabular-nums">{pct}%</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <p className="text-sm font-medium text-amber-800">Payment required</p>
      <p className="text-xs text-amber-700 mt-1">
        {region.name} has reached {region.member_threshold} active members.
        Adding a venue here requires an additional venue subscription at £9.99/year.
      </p>
    </div>
  );
}

export function NewVenueForm({
  regions,
  isPrimaryVenue,
}: {
  regions: RegionWithStats[];
  isPrimaryVenue: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fields, setFields] = useState<VenueFields>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof VenueFields, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const selectedRegion = regions.find((r) => r.id === fields.regionId) ?? null;
  const isBillableRegion = selectedRegion
    ? selectedRegion.active_member_count >= selectedRegion.member_threshold
    : false;

  function set(key: keyof VenueFields) {
    return (value: string) => {
      setFields((prev) => ({ ...prev, [key]: value }));
      if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
      setServerError(null);
    };
  }

  function handleCreate() {
    setServerError(null);
    startTransition(async () => {
      const result = await createVenue(fields);
      if ('fieldErrors' in result && result.fieldErrors) {
        setErrors(result.fieldErrors as Partial<Record<keyof VenueFields, string>>);
        return;
      }
      if ('error' in result && result.error) {
        setServerError(result.error);
        return;
      }
      if ('locationId' in result) {
        router.push(`/locations/${result.locationId}`);
      }
    });
  }

  return (
    <div className="max-w-xl space-y-5">
      {serverError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {serverError}
        </div>
      )}

      <Field
        label="Venue name" id="venue-name" value={fields.name} onChange={set('name')}
        placeholder='e.g. "High Street Branch"' error={errors.name} required
        autoComplete="organization"
      />

      {/* Region selector */}
      <div>
        <label htmlFor="venue-region" className="mb-1.5 block text-sm font-medium text-gray-700">
          Region <span className="ml-0.5 text-red-400">*</span>
        </label>
        <select
          id="venue-region"
          value={fields.regionId}
          onChange={(e) => {
            setFields((prev) => ({ ...prev, regionId: e.target.value }));
            if (errors.regionId) setErrors((prev) => ({ ...prev, regionId: undefined }));
            setServerError(null);
          }}
          className={inputCls(!!errors.regionId) + ' cursor-pointer'}
        >
          <option value="">Select region…</option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        {errors.regionId && <p className="mt-1 text-xs text-red-500" role="alert">{errors.regionId}</p>}

        {selectedRegion && !isBillableRegion && <RegionStatusBadge region={selectedRegion} />}
        {selectedRegion && isBillableRegion && !isPrimaryVenue && (
          <RegionStatusBadge region={selectedRegion} />
        )}
        {isPrimaryVenue && selectedRegion && isBillableRegion && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-medium text-amber-800">Subscription required</p>
            <p className="text-xs text-amber-700 mt-1">
              {selectedRegion.name} has reached its member threshold. After approval, you will need to activate
              an annual subscription (£49.99/year) to go live.
            </p>
          </div>
        )}
      </div>

      <Field
        label="Address line 1" id="address-line-1" value={fields.addressLine1}
        onChange={set('addressLine1')} placeholder="12 Mill Street"
        error={errors.addressLine1} autoComplete="address-line1" required
      />
      <Field
        label="Address line 2" id="address-line-2" value={fields.addressLine2}
        onChange={set('addressLine2')} placeholder="Unit 4" optional autoComplete="address-line2"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="Town / City" id="town" value={fields.town} onChange={set('town')}
          placeholder="Alloa" error={errors.town} autoComplete="address-level2" required
        />
        <Field
          label="County" id="county" value={fields.county} onChange={set('county')}
          placeholder="Clackmannanshire" optional autoComplete="address-level1"
        />
      </div>
      <div className="max-w-[180px]">
        <Field
          label="Postcode" id="postcode" value={fields.postcode} onChange={set('postcode')}
          placeholder="FK10 1AA" error={errors.postcode} autoComplete="postal-code" required
        />
      </div>

      {/* ── Venue listing content ───────────────────────────────────────── */}
      <div className="border-t border-gray-100 pt-5 space-y-4">
        <div>
          <p className="text-sm font-medium text-gray-700">
            Venue listing content{' '}
            <span className="ml-1 text-xs font-normal text-gray-400">optional</span>
          </p>
          <p className="mt-1 text-xs text-gray-400">
            You can also add a logo, cover image, and opening hours after saving from the venue edit page.
          </p>
        </div>

        <Field
          label="Short description" id="venue-short-desc" value={fields.shortDescription}
          onChange={set('shortDescription')} placeholder="A cosy café in the heart of Alloa…"
          optional
        />

        <div>
          <label htmlFor="venue-description" className="mb-1.5 block text-sm font-medium text-gray-700">
            Full description{' '}
            <span className="ml-1.5 text-xs font-normal text-gray-400">optional</span>
          </label>
          <div className="relative">
            <textarea
              id="venue-description"
              value={fields.description}
              onChange={(e) => set('description')(e.target.value)}
              rows={4}
              maxLength={DESC_MAX}
              placeholder="Tell members what makes this venue worth visiting…"
              className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-green-700/30 focus:border-green-700 pb-6"
            />
            <span className={[
              'pointer-events-none absolute bottom-2.5 right-3 text-xs tabular-nums',
              fields.description.length > 450 ? 'text-amber-500' : 'text-gray-300',
            ].join(' ')}>
              {fields.description.length}/{DESC_MAX}
            </span>
          </div>
        </div>

        <Field
          label="Venue phone" id="venue-phone" value={fields.phone}
          onChange={set('phone')} placeholder="e.g. 01259 123456"
          optional autoComplete="tel"
        />

        <Field
          label="Venue website" id="venue-website" value={fields.websiteUrl}
          onChange={set('websiteUrl')} placeholder="https://yoursite.com"
          optional autoComplete="url"
        />
      </div>

      {isBillableRegion && !isPrimaryVenue && (
        <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          This venue cannot be added for free. Add an additional venue (£9.99/year) from the Billing page first,
          then return here to add this venue.
        </div>
      )}

      {(!isBillableRegion || isPrimaryVenue) && (
        <div className="border-t border-gray-100 pt-5">
          <button
            type="button"
            onClick={handleCreate}
            disabled={isPending}
            className="rounded-lg bg-green-800 px-6 py-2.5 text-sm font-semibold text-white
                       transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? 'Saving…' : 'Add location'}
          </button>
        </div>
      )}
    </div>
  );
}
