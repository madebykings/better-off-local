'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createVenue, type VenueFields } from '@/lib/actions/location';
import { purchaseVenueSlot } from '@/lib/actions/venue_billing';

const EMPTY: VenueFields = {
  name:         '',
  addressLine1: '',
  addressLine2: '',
  town:         '',
  county:       '',
  postcode:     '',
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
  label, id, value, onChange, placeholder, error, optional, autoComplete,
}: {
  label: string; id: string; value: string; onChange: (v: string) => void;
  placeholder?: string; error?: string; optional?: boolean; autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
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

export function NewVenueForm({ atCap }: { atCap: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fields, setFields] = useState<VenueFields>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof VenueFields, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [purchasePending, setPurchasePending] = useState(false);

  function set(key: keyof VenueFields) {
    return (value: string) => {
      setFields((prev) => ({ ...prev, [key]: value }));
      if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
      setServerError(null);
    };
  }

  async function handlePurchase() {
    setPurchasePending(true);
    setServerError(null);
    try {
      const result = await purchaseVenueSlot();
      if (result?.error) {
        setServerError(result.error);
        return;
      }
      // Allowance increased — reload the page so the form appears.
      router.refresh();
    } finally {
      setPurchasePending(false);
    }
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
        router.push('/locations');
      }
    });
  }

  if (atCap) {
    return (
      <div>
        {serverError && (
          <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {serverError}
          </div>
        )}
        <button
          type="button"
          onClick={handlePurchase}
          disabled={purchasePending}
          className="rounded-lg bg-green-800 px-6 py-2.5 text-sm font-semibold text-white
                     transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {purchasePending ? 'Processing…' : 'Purchase venue slot — £10/year'}
        </button>
        <p className="mt-2 text-xs text-gray-400">
          Pro-rated charge applied to your existing payment method.
        </p>
      </div>
    );
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
        placeholder='e.g. "High Street Branch"' error={errors.name}
        autoComplete="organization"
      />
      <Field
        label="Address line 1" id="address-line-1" value={fields.addressLine1}
        onChange={set('addressLine1')} placeholder="12 Mill Street"
        error={errors.addressLine1} autoComplete="address-line1"
      />
      <Field
        label="Address line 2" id="address-line-2" value={fields.addressLine2}
        onChange={set('addressLine2')} placeholder="Unit 4" optional autoComplete="address-line2"
      />
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Town / City" id="town" value={fields.town} onChange={set('town')}
          placeholder="Alloa" error={errors.town} autoComplete="address-level2"
        />
        <Field
          label="County" id="county" value={fields.county} onChange={set('county')}
          placeholder="Clackmannanshire" optional autoComplete="address-level1"
        />
      </div>
      <div className="max-w-[180px]">
        <Field
          label="Postcode" id="postcode" value={fields.postcode} onChange={set('postcode')}
          placeholder="FK10 1AA" error={errors.postcode} autoComplete="postal-code"
        />
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
        <span className="text-sm text-gray-500">🇬🇧 Serving United Kingdom</span>
      </div>

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
    </div>
  );
}
