'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  createOffer,
  updateOffer,
  submitOfferForApproval,
  togglePauseOffer,
  deleteDraftOffer,
  type OfferFields,
  type OfferActionResult,
  type CreateOfferResult,
} from '@/lib/actions/offers';
import {
  OFFER_TYPES,
  type OfferType,
  EMPTY_OFFER,
} from '@/lib/utils/first_offer';
import { REDEMPTION_RULES, type RedemptionRule } from '@/lib/utils/redemption_rules';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OFFER_TYPE_CONFIG: Record<OfferType, { label: string; hint: string; icon: string }> = {
  percentage_discount: { label: 'Percentage off', hint: 'e.g. 10% off', icon: '%' },
  fixed_discount:      { label: 'Fixed amount off', hint: 'e.g. £5 off', icon: '£' },
  free_item:           { label: 'Free item',        hint: 'e.g. Free coffee', icon: '🎁' },
  other:               { label: 'Special deal',     hint: 'e.g. Members-only event', icon: '⭐' },
};

const RULE_LABELS: Record<RedemptionRule, string> = {
  unlimited:       'Unlimited — members can use any number of times',
  once_per_member: 'Once per member',
  once_per_day:    'Once per member per day',
  once_per_week:   'Once per member per week',
  once_per_month:  'Once per member per month',
};

const DESC_MAX = 500;

// ---------------------------------------------------------------------------
// Field component
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

function inputCls(hasError: boolean) {
  return [
    'w-full rounded-lg border px-3 py-2.5 text-sm text-gray-900',
    'placeholder:text-gray-400 transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-green-700/20 focus:border-green-700',
    'disabled:bg-gray-50 disabled:text-gray-500',
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

interface OfferFormProps {
  mode: 'create' | 'edit';
  offerId?: string;
  offerStatus?: string;
  initialData?: Partial<OfferFields>;
  locations?: Location[];
}

// ---------------------------------------------------------------------------
// OfferForm
// ---------------------------------------------------------------------------

export function OfferForm({ mode, offerId, offerStatus, initialData, locations }: OfferFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [fields, setFields] = useState<OfferFields>({
    ...EMPTY_OFFER,
    venueScope: 'all',
    selectedLocationIds: [],
    newCustomersOnly: false,
    ...initialData,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof OfferFields, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function set(key: keyof OfferFields) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setFields((prev) => ({ ...prev, [key]: e.target.value }));
      if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
      setSaved(false);
    };
  }

  function setOfferType(type: OfferType) {
    setFields((prev) => ({ ...prev, offerType: type }));
    if (errors.offerType) setErrors((prev) => ({ ...prev, offerType: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    setSaved(false);

    startTransition(async () => {
      let result: OfferActionResult | CreateOfferResult | null;

      if (mode === 'create') {
        result = await createOffer(fields);
        if (result && 'offerId' in result) {
          router.push(`/offers/${result.offerId}`);
          return;
        }
      } else {
        result = await updateOffer(offerId!, fields);
        if (result === null) {
          setSaved(true);
          return;
        }
      }

      if (result && 'fieldErrors' in result && result.fieldErrors) {
        setErrors(result.fieldErrors as Partial<Record<keyof OfferFields, string>>);
        return;
      }
      if (result && 'error' in result && result.error) {
        setServerError(result.error);
      }
    });
  }

  const isDraft = !offerStatus || offerStatus === 'draft';
  const isLiveOrPaused = offerStatus === 'live' || offerStatus === 'paused';
  const canEdit = isDraft || isLiveOrPaused;
  const descCount = fields.description.length;

  return (
    <div className="max-w-2xl space-y-8">
      {/* Status actions (edit mode only) */}
      {mode === 'edit' && offerStatus && (
        <div className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200">
          <div className="flex-1">
            <span className="text-sm text-gray-500">Status: </span>
            <span className="text-sm font-medium text-gray-800 capitalize">
              {offerStatus.replace('_', ' ')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isDraft && (
              <form action={submitOfferForApproval}>
                <input type="hidden" name="offer_id" value={offerId} />
                <button
                  type="submit"
                  className="rounded-lg bg-green-800 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
                >
                  Submit for approval
                </button>
              </form>
            )}
            {isLiveOrPaused && (
              <form action={togglePauseOffer}>
                <input type="hidden" name="offer_id" value={offerId} />
                <button
                  type="submit"
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  {offerStatus === 'paused' ? 'Resume' : 'Pause'}
                </button>
              </form>
            )}
            {isDraft && (
              <form action={deleteDraftOffer}>
                <input type="hidden" name="offer_id" value={offerId} />
                <button
                  type="submit"
                  onClick={(e) => {
                    if (!confirm('Delete this draft offer?')) e.preventDefault();
                  }}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Info banner for non-editable statuses */}
      {mode === 'edit' && !canEdit && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
          This offer cannot be edited in its current status ({offerStatus}).
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {serverError && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {serverError}
          </div>
        )}
        {saved && (
          <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            Changes saved.
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
                  disabled={!canEdit || isPending}
                  className={[
                    'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                    active
                      ? 'border-green-700 bg-green-50'
                      : 'border-gray-200 bg-white hover:border-gray-300',
                    !canEdit ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
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

        {/* Venue scope (only shown when retailer has 2+ locations) */}
        {locations && locations.length > 1 && (
          <Field label="Venue applicability">
            <div className="space-y-2 mt-1">
              {(['all', 'specific'] as const).map((scope) => (
                <label
                  key={scope}
                  className={[
                    'flex items-start gap-3 rounded-lg border p-3 cursor-pointer',
                    fields.venueScope === scope
                      ? 'border-green-700 bg-green-50'
                      : 'border-gray-200 bg-white hover:border-gray-300',
                    !canEdit ? 'opacity-60 cursor-not-allowed' : '',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name="venueScope"
                    value={scope}
                    checked={fields.venueScope === scope}
                    onChange={() => {
                      if (!canEdit || isPending) return;
                      setFields((prev) => ({
                        ...prev,
                        venueScope: scope,
                        selectedLocationIds: scope === 'all' ? [] : prev.selectedLocationIds,
                      }));
                    }}
                    disabled={!canEdit || isPending}
                    className="mt-0.5 accent-green-700"
                  />
                  <span>
                    <span className={`block text-sm font-medium ${fields.venueScope === scope ? 'text-green-800' : 'text-gray-800'}`}>
                      {scope === 'all' ? 'All locations' : 'Specific locations'}
                    </span>
                    <span className="block text-xs text-gray-400 mt-0.5">
                      {scope === 'all'
                        ? 'Offer applies to every venue'
                        : 'Choose which venues this offer applies to'}
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
                        disabled={!canEdit || isPending}
                        onChange={(e) => {
                          setFields((prev) => ({
                            ...prev,
                            selectedLocationIds: e.target.checked
                              ? [...prev.selectedLocationIds, loc.id]
                              : prev.selectedLocationIds.filter((id) => id !== loc.id),
                          }));
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

        {/* Benefit text */}
        <Field
          label="Benefit"
          required
          hint='The short value shown on the offer card, e.g. "10% off" or "Free coffee"'
          error={errors.benefitText}
        >
          <input
            type="text"
            value={fields.benefitText}
            onChange={set('benefitText')}
            placeholder='e.g. 10% off'
            maxLength={60}
            className={inputCls(!!errors.benefitText)}
            disabled={!canEdit || isPending}
          />
        </Field>

        {/* Headline */}
        <Field label="Headline" required hint="Full offer title shown on the detail page" error={errors.headline}>
          <input
            type="text"
            value={fields.headline}
            onChange={set('headline')}
            placeholder='e.g. 10% off everything, every visit'
            maxLength={120}
            className={inputCls(!!errors.headline)}
            disabled={!canEdit || isPending}
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
              placeholder="Show your membership card to redeem. Valid on all full-price items. Cannot be combined with other offers."
              className={[inputCls(!!errors.description), 'resize-none pb-6'].join(' ')}
              disabled={!canEdit || isPending}
            />
            <span
              className={[
                'pointer-events-none absolute bottom-2.5 right-3 text-[11px] tabular-nums',
                descCount > 450 ? 'text-amber-500' : 'text-gray-300',
              ].join(' ')}
            >
              {descCount}/{DESC_MAX}
            </span>
          </div>
        </Field>

        {/* Redemption rule */}
        <Field label="Redemption limit" error={errors.redemptionRule}>
          <select
            value={fields.redemptionRule}
            onChange={set('redemptionRule')}
            className={inputCls(false) + ' cursor-pointer'}
            disabled={!canEdit || isPending}
          >
            {REDEMPTION_RULES.map((r) => (
              <option key={r} value={r}>{RULE_LABELS[r]}</option>
            ))}
          </select>
        </Field>

        {/* Optional: dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Start date" hint="Optional — leave blank to start immediately">
            <input
              type="date"
              value={fields.startDate}
              onChange={set('startDate')}
              className={inputCls(false)}
              disabled={!canEdit || isPending}
            />
          </Field>
          <Field label="End date" hint="Optional — leave blank for no expiry" error={errors.endDate}>
            <input
              type="date"
              value={fields.endDate}
              onChange={set('endDate')}
              min={fields.startDate || undefined}
              className={inputCls(!!errors.endDate)}
              disabled={!canEdit || isPending}
            />
          </Field>
        </div>

        {/* Optional: cap */}
        <Field
          label="Total redemption cap"
          hint="Optional — maximum number of times this offer can be redeemed across all members"
          error={errors.totalCap}
        >
          <input
            type="number"
            value={fields.totalCap}
            onChange={set('totalCap')}
            placeholder='e.g. 100'
            min={1}
            className={inputCls(!!errors.totalCap)}
            disabled={!canEdit || isPending}
          />
        </Field>

        {/* New customers only */}
        <Field label="Audience">
          <label className={[
            'flex items-start gap-3 rounded-lg border p-3 cursor-pointer select-none',
            fields.newCustomersOnly
              ? 'border-green-700 bg-green-50'
              : 'border-gray-200 bg-white hover:border-gray-300',
            !canEdit ? 'opacity-60 cursor-not-allowed' : '',
          ].join(' ')}>
            <input
              type="checkbox"
              checked={fields.newCustomersOnly}
              disabled={!canEdit || isPending}
              onChange={(e) => {
                if (!canEdit || isPending) return;
                setFields((prev) => ({ ...prev, newCustomersOnly: e.target.checked }));
              }}
              className="mt-0.5 accent-green-700"
            />
            <span>
              <span className={`block text-sm font-medium ${fields.newCustomersOnly ? 'text-green-800' : 'text-gray-800'}`}>
                New customers only
              </span>
              <span className="block text-xs text-gray-400 mt-0.5">
                This offer can only be redeemed by members who have never previously used an offer at your business.
              </span>
            </span>
          </label>
        </Field>

        {canEdit && (
          <div className="flex items-center gap-4 border-t border-gray-100 pt-6">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-green-800 px-6 py-2.5 text-sm font-semibold text-white
                         transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending
                ? mode === 'create' ? 'Creating…' : 'Saving…'
                : mode === 'create' ? 'Create offer' : 'Save changes'}
            </button>
            {saved && <span className="text-sm text-green-700">Saved ✓</span>}
          </div>
        )}
      </form>
    </div>
  );
}
