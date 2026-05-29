'use client';

import { useState } from 'react';
import { updateRetailerLocation, type LocationFields } from '@/lib/actions/location';

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
        {optional && <span className="ml-1.5 text-xs font-normal text-gray-400">optional</span>}
      </label>
      <input
        id={id}
        type="text"
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

export function LocationForm({ initialData }: { initialData: LocationFields }) {
  const [fields, setFields] = useState<LocationFields>(initialData);
  const [errors, setErrors] = useState<Partial<Record<keyof LocationFields, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, setIsPending] = useState(false);

  function set(key: keyof LocationFields) {
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
      const result = await updateRetailerLocation(fields);
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

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-xl space-y-5">
      {serverError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {serverError}
        </div>
      )}
      {saved && (
        <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Location saved.
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

      <div className="flex items-center gap-4 border-t border-gray-100 pt-5">
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
  );
}
