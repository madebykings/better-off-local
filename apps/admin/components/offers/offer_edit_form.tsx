'use client';

import { useState, useTransition } from 'react';
import {
  adminUpdateOffer,
  type AdminOfferFields,
} from '@/lib/actions/offer_admin';
import {
  OFFER_TYPES,
  type OfferType,
  computeValueText,
  needsDiscountValue,
  discountValueLabel,
  discountValuePlaceholder,
} from '@/lib/utils/first_offer';
import { REDEMPTION_RULES, type RedemptionRule } from '@/lib/utils/redemption_rules';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OFFER_TYPE_CONFIG: Record<OfferType, { label: string; hint: string; icon: string }> = {
  percentage_discount: { label: 'Percentage off',   hint: 'e.g. 10% off',             icon: '%'  },
  fixed_discount:      { label: 'Fixed amount off', hint: 'e.g. £5 off',              icon: '£'  },
  free_item:           { label: 'Free item',         hint: 'e.g. Free coffee',         icon: '🎁' },
  buy_one_get_one:     { label: 'Buy one get one',  hint: 'e.g. BOGOF main course',    icon: '2️⃣' },
  meal_deal:           { label: 'Meal deal',         hint: 'e.g. Lunch meal deal',     icon: '🍱' },
  other:               { label: 'Special deal',      hint: 'e.g. Members-only event',  icon: '⭐' },
};

const RULE_LABELS: Record<RedemptionRule, string> = {
  unlimited:       'Unlimited',
  once_per_member: 'Once per member',
  once_per_day:    'Once per member per day',
  once_per_week:   'Once per member per week',
  once_per_month:  'Once per member per month',
};

const DESC_MAX = 500;

// ---------------------------------------------------------------------------
// Field helper
// ---------------------------------------------------------------------------

function Field({ label, required, hint, error, children }: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-red-400">*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1.5 text-xs text-gray-400">{hint}</p>}
      {error && <p className="mt-1.5 text-xs text-red-500" role="alert">{error}</p>}
    </div>
  );
}

function inputCls(hasError = false) {
  return [
    'w-full rounded-lg border px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400',
    'focus:outline-none focus:ring-2 focus:ring-green-700/20 focus:border-green-700 transition-colors',
    hasError ? 'border-red-300 bg-red-50/50' : 'border-gray-200 bg-white',
  ].join(' ');
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Location {
  id: string;
  name: string | null;
  address_line_1: string | null;
}

interface Props {
  offerId: string;
  initialFields: AdminOfferFields;
  currentImageUrl: string | null;
  locations: Location[];
}

// ---------------------------------------------------------------------------
// AdminOfferEditForm
// ---------------------------------------------------------------------------

export function AdminOfferEditForm({ offerId, initialFields, currentImageUrl, locations }: Props) {
  const [fields, setFields] = useState<AdminOfferFields>(initialFields);
  const [errors, setErrors] = useState<Partial<Record<keyof AdminOfferFields, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function set(key: keyof AdminOfferFields) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setFields((prev) => ({ ...prev, [key]: e.target.value }));
      if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
      setSaved(false);
    };
  }

  function setOfferType(type: OfferType) {
    setFields((prev) => ({ ...prev, offerType: type }));
    if (errors.offerType) setErrors((prev) => ({ ...prev, offerType: undefined }));
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    setSaved(false);

    startTransition(async () => {
      const result = await adminUpdateOffer(offerId, fields);
      if (result === null) {
        setSaved(true);
        return;
      }
      if (result.fieldErrors) {
        setErrors(result.fieldErrors as Partial<Record<keyof AdminOfferFields, string>>);
        return;
      }
      if (result.error) {
        setServerError(result.error);
      }
    });
  }

  const descCount = fields.description.length;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {serverError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {serverError}
        </div>
      )}
      {saved && (
        <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Offer saved.
        </div>
      )}

      {/* Offer type */}
      <Field label="Offer type" required error={errors.offerType}>
        <div className="grid grid-cols-2 gap-2 mt-1">
          {OFFER_TYPES.map((type) => {
            const cfg = OFFER_TYPE_CONFIG[type];
            const active = fields.offerType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setOfferType(type)}
                disabled={isPending}
                className={[
                  'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors cursor-pointer',
                  active ? 'border-green-700 bg-green-50' : 'border-gray-200 bg-white hover:border-gray-300',
                ].join(' ')}
              >
                <span className="text-lg leading-none">{cfg.icon}</span>
                <span>
                  <span className={`block text-sm font-medium ${active ? 'text-green-800' : 'text-gray-800'}`}>
                    {cfg.label}
                  </span>
                  <span className="block text-xs text-gray-400 mt-0.5">{cfg.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Field>

      {/* Discount value */}
      {needsDiscountValue(fields.offerType) && (
        <Field
          label={discountValueLabel(fields.offerType)}
          required
          hint={discountValuePlaceholder(fields.offerType)}
          error={errors.discountValue}
        >
          <input
            type="number"
            value={fields.discountValue}
            onChange={set('discountValue')}
            placeholder={fields.offerType === 'percentage_discount' ? '10' : '5'}
            min={0.01}
            step={fields.offerType === 'percentage_discount' ? 1 : 0.01}
            className={inputCls(!!errors.discountValue)}
            disabled={isPending}
          />
        </Field>
      )}

      {/* Badge preview */}
      {fields.offerType && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Card badge:</span>
          <span className={[
            'inline-block rounded px-2 py-0.5 text-xs font-bold text-white',
            fields.offerType === 'percentage_discount' ? 'bg-green-700' :
            fields.offerType === 'fixed_discount'      ? 'bg-blue-600' :
            fields.offerType === 'buy_one_get_one'     ? 'bg-purple-600' :
            'bg-orange-500',
          ].join(' ')}>
            {computeValueText(fields.offerType, fields.discountValue) || '—'}
          </span>
        </div>
      )}

      {/* Headline */}
      <Field label="Headline" required hint="Full offer title shown on the detail page" error={errors.headline}>
        <input
          type="text"
          value={fields.headline}
          onChange={set('headline')}
          placeholder="e.g. 10% off everything, every visit"
          maxLength={120}
          className={inputCls(!!errors.headline)}
          disabled={isPending}
        />
      </Field>

      {/* Short summary */}
      <Field label="Short summary" hint="Optional — short card teaser (1–2 lines). Admin only.">
        <input
          type="text"
          value={fields.shortSummary}
          onChange={set('shortSummary')}
          placeholder="e.g. Show your membership card at the till"
          maxLength={160}
          className={inputCls(false)}
          disabled={isPending}
        />
      </Field>

      {/* Description */}
      <Field
        label="Description / terms"
        required
        hint="Tell members exactly how to redeem and any conditions."
        error={errors.description}
      >
        <div className="relative">
          <textarea
            value={fields.description}
            onChange={set('description')}
            maxLength={DESC_MAX}
            rows={4}
            placeholder="Show your membership card to redeem. Valid on all full-price items."
            className={[inputCls(!!errors.description), 'resize-none pb-6'].join(' ')}
            disabled={isPending}
          />
          <span className={[
            'pointer-events-none absolute bottom-2.5 right-3 text-[11px] tabular-nums',
            descCount > 450 ? 'text-amber-500' : 'text-gray-300',
          ].join(' ')}>
            {descCount}/{DESC_MAX}
          </span>
        </div>
      </Field>

      {/* Terms text */}
      <Field label="Terms and conditions" hint="Optional — displayed separately from description. Admin only.">
        <textarea
          value={fields.termsText}
          onChange={set('termsText')}
          rows={3}
          placeholder="Cannot be combined with any other offer. Excludes sale items."
          className={[inputCls(false), 'resize-none'].join(' ')}
          disabled={isPending}
        />
      </Field>

      {/* Redemption rule */}
      <Field label="Redemption limit" error={errors.redemptionRule}>
        <select
          value={fields.redemptionRule}
          onChange={set('redemptionRule')}
          className={inputCls(false) + ' cursor-pointer'}
          disabled={isPending}
        >
          {REDEMPTION_RULES.map((r) => (
            <option key={r} value={r}>{RULE_LABELS[r]}</option>
          ))}
        </select>
      </Field>

      {/* Dates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Start date" hint="Leave blank to start immediately">
          <input
            type="date"
            value={fields.startDate}
            onChange={set('startDate')}
            className={inputCls(false)}
            disabled={isPending}
          />
        </Field>
        <Field label="End date" hint="Leave blank for no expiry" error={errors.endDate}>
          <input
            type="date"
            value={fields.endDate}
            onChange={set('endDate')}
            min={fields.startDate || undefined}
            className={inputCls(!!errors.endDate)}
            disabled={isPending}
          />
        </Field>
      </div>

      {/* Redemption cap */}
      <Field
        label="Total redemption cap"
        hint="Optional — maximum redemptions across all members"
        error={errors.totalCap}
      >
        <input
          type="number"
          value={fields.totalCap}
          onChange={set('totalCap')}
          placeholder="e.g. 100"
          min={1}
          className={inputCls(!!errors.totalCap)}
          disabled={isPending}
        />
      </Field>

      {/* Estimated saving */}
      <Field
        label="Estimated customer saving (pence)"
        hint="Amount saved per redemption in pence. e.g. 350 = £3.50. Used in analytics."
        error={errors.estimatedSavingPence}
      >
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">p</span>
          <input
            type="number"
            value={fields.estimatedSavingPence}
            onChange={set('estimatedSavingPence')}
            placeholder="e.g. 350"
            min={1}
            className={[inputCls(!!errors.estimatedSavingPence), 'pl-7'].join(' ')}
            disabled={isPending}
          />
        </div>
      </Field>

      {/* New customers only */}
      <Field label="Audience">
        <label className={[
          'flex items-start gap-3 rounded-lg border p-3 cursor-pointer select-none',
          fields.newCustomersOnly ? 'border-green-700 bg-green-50' : 'border-gray-200 bg-white hover:border-gray-300',
        ].join(' ')}>
          <input
            type="checkbox"
            checked={fields.newCustomersOnly}
            disabled={isPending}
            onChange={(e) => {
              setFields((prev) => ({ ...prev, newCustomersOnly: e.target.checked }));
              setSaved(false);
            }}
            className="mt-0.5 accent-green-700"
          />
          <span>
            <span className={`block text-sm font-medium ${fields.newCustomersOnly ? 'text-green-800' : 'text-gray-800'}`}>
              New customers only
            </span>
            <span className="block text-xs text-gray-400 mt-0.5">
              Only redeemable by members who have never used an offer at this business.
            </span>
          </span>
        </label>
      </Field>

      {/* Venue scope */}
      {locations.length > 1 && (
        <Field label="Venue applicability">
          <div className="space-y-2 mt-1">
            {(['all', 'specific'] as const).map((scope) => (
              <label
                key={scope}
                className={[
                  'flex items-start gap-3 rounded-lg border p-3 cursor-pointer',
                  fields.venueScope === scope ? 'border-green-700 bg-green-50' : 'border-gray-200 bg-white hover:border-gray-300',
                ].join(' ')}
              >
                <input
                  type="radio"
                  name="venueScope"
                  value={scope}
                  checked={fields.venueScope === scope}
                  onChange={() => {
                    setFields((prev) => ({
                      ...prev,
                      venueScope: scope,
                      selectedLocationIds: scope === 'all' ? [] : prev.selectedLocationIds,
                    }));
                    setSaved(false);
                  }}
                  disabled={isPending}
                  className="mt-0.5 accent-green-700"
                />
                <span>
                  <span className={`block text-sm font-medium ${fields.venueScope === scope ? 'text-green-800' : 'text-gray-800'}`}>
                    {scope === 'all' ? 'All locations' : 'Specific locations'}
                  </span>
                  <span className="block text-xs text-gray-400 mt-0.5">
                    {scope === 'all' ? 'Applies to every venue' : 'Choose specific venues'}
                  </span>
                </span>
              </label>
            ))}
          </div>

          {fields.venueScope === 'specific' && (
            <div className="mt-3 space-y-2 pl-1">
              {locations.map((loc) => {
                const checked = fields.selectedLocationIds.includes(loc.id);
                return (
                  <label key={loc.id} className="flex items-center gap-3 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isPending}
                      onChange={(e) => {
                        setFields((prev) => ({
                          ...prev,
                          selectedLocationIds: e.target.checked
                            ? [...prev.selectedLocationIds, loc.id]
                            : prev.selectedLocationIds.filter((id) => id !== loc.id),
                        }));
                        setSaved(false);
                      }}
                      className="accent-green-700"
                    />
                    <span className="text-gray-800">
                      {loc.name ?? loc.address_line_1 ?? loc.id}
                    </span>
                  </label>
                );
              })}
              {fields.selectedLocationIds.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">Select at least one location.</p>
              )}
            </div>
          )}
        </Field>
      )}

      {/* Cover image — read-only preview; upload not yet available from admin */}
      {currentImageUrl && (
        <Field label="Cover image" hint="Image upload from admin is not yet available. Retailers can update via their portal.">
          <div className="w-full overflow-hidden rounded-lg border border-gray-200 max-w-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={currentImageUrl} alt="Offer cover" className="w-full object-cover max-h-40" />
          </div>
        </Field>
      )}

      <div className="flex items-center gap-4 border-t border-gray-100 pt-6">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-green-800 px-6 py-2.5 text-sm font-semibold text-white
                     transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Save changes'}
        </button>
        {saved && <span className="text-sm text-green-700">Saved ✓</span>}
      </div>
    </form>
  );
}
