'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  createOffer,
  updateOffer,
  submitOfferForApproval,
  togglePauseOffer,
  deleteDraftOffer,
  archiveOffer,
  type OfferFields,
  type OfferActionResult,
  type CreateOfferResult,
} from '@/lib/actions/offers';
import { uploadOfferImage } from '@/lib/actions/offer_images';
import {
  OFFER_TYPES,
  type OfferType,
  EMPTY_OFFER,
  computeValueText,
  needsDiscountValue,
  needsLoyaltyConfig,
  discountValueLabel,
  discountValuePlaceholder,
  type LoyaltyConfigFields,
  EMPTY_LOYALTY_CONFIG,
  LOYALTY_REWARD_TYPES,
} from '@/lib/utils/first_offer';
import { REDEMPTION_RULES, type RedemptionRule } from '@/lib/utils/redemption_rules';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OFFER_TYPE_CONFIG: Record<OfferType, { label: string; hint: string; icon: string; savingHint: string }> = {
  percentage_discount: { label: 'Percentage off',    hint: 'e.g. 10% off',                icon: '%',  savingHint: 'e.g. 0.50 for typical 10% off a £5 coffee' },
  fixed_discount:      { label: 'Fixed amount off',  hint: 'e.g. £5 off',                 icon: '£',  savingHint: 'e.g. 5.00 for £5 off' },
  free_item:           { label: 'Free item',          hint: 'e.g. Free coffee',            icon: '🎁', savingHint: 'e.g. 3.50 for a £3.50 item' },
  buy_one_get_one:     { label: 'Buy one get one',   hint: 'e.g. BOGOF main course',       icon: '2️⃣', savingHint: 'e.g. 8.00 for half the cost of a £16 item' },
  meal_deal:           { label: 'Meal deal',          hint: 'e.g. Lunch meal deal',        icon: '🍱', savingHint: 'e.g. 4.00 if the deal saves ~£4 vs buying separately' },
  loyalty_visits:      { label: 'Loyalty stamp card', hint: 'e.g. Collect 8 stamps, free coffee', icon: '🃏', savingHint: 'e.g. 3.50 for the reward value (free coffee)' },
  venue_referral:      { label: 'Refer a friend',     hint: 'e.g. Refer a friend, get a free coffee', icon: '🤝', savingHint: 'e.g. 3.50 for the reward the referrer receives' },
  other:               { label: 'Special deal',       hint: 'e.g. Members-only event',    icon: '⭐', savingHint: 'Estimated pounds saved per use, if applicable' },
};

const LOYALTY_REWARD_TYPE_LABELS: Record<string, string> = {
  free_item:           'Free item',
  percentage_discount: 'Percentage discount',
  fixed_discount:      'Fixed amount off',
};

const STAMP_COOLDOWN_OPTIONS = [
  { value: '0',  label: 'No minimum — any number of stamps per day' },
  { value: '1',  label: 'At least 1 hour between stamps' },
  { value: '4',  label: 'At least 4 hours between stamps' },
  { value: '20', label: 'At least 20 hours (roughly once a day)' },
  { value: '44', label: 'At least 44 hours (roughly once every 2 days)' },
];

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
    imageUrl: '',
    estimatedSavingPence: '',
    ...initialData,
  });
  const [loyaltyConfig, setLoyaltyConfig] = useState<LoyaltyConfigFields>(
    initialData?.loyaltyConfig ?? EMPTY_LOYALTY_CONFIG,
  );
  const [errors, setErrors] = useState<Partial<Record<keyof OfferFields, string>>>({});
  const [loyaltyErrors, setLoyaltyErrors] = useState<Partial<Record<keyof LoyaltyConfigFields, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  function setLoyalty(key: keyof LoyaltyConfigFields) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setLoyaltyConfig((prev) => ({ ...prev, [key]: e.target.value }));
      if (loyaltyErrors[key]) setLoyaltyErrors((prev) => ({ ...prev, [key]: undefined }));
      setSaved(false);
    };
  }

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
    if (needsLoyaltyConfig(type) && !loyaltyConfig.rewardDescription) {
      setLoyaltyConfig(initialData?.loyaltyConfig ?? EMPTY_LOYALTY_CONFIG);
    }
  }

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageError(null);
    setImageUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const result = await uploadOfferImage(fd);
      if ('error' in result) {
        setImageError(result.error);
      } else {
        setFields((prev) => ({ ...prev, imageUrl: result.url }));
      }
    } finally {
      setImageUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    setSaved(false);

    startTransition(async () => {
      let result: OfferActionResult | CreateOfferResult | null;

      const submittedFields: OfferFields = {
        ...fields,
        loyaltyConfig: needsLoyaltyConfig(fields.offerType) ? loyaltyConfig : undefined,
      };

      if (mode === 'create') {
        result = await createOffer(submittedFields);
        if (result && 'offerId' in result) {
          router.push(`/offers/${result.offerId}`);
          return;
        }
      } else {
        result = await updateOffer(offerId!, submittedFields);
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
  const canEdit = isDraft || isLiveOrPaused || offerStatus === 'pending' || offerStatus === 'approved' || offerStatus === 'rejected';
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
            {isLiveOrPaused && (
              <form action={archiveOffer}>
                <input type="hidden" name="offer_id" value={offerId} />
                <button
                  type="submit"
                  onClick={(e) => {
                    if (!confirm('Archive this offer? It will no longer be visible to members.')) e.preventDefault();
                  }}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50"
                >
                  Archive
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

        {/* Discount value (only for percentage / fixed types) */}
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
              disabled={!canEdit || isPending}
            />
          </Field>
        )}

        {/* Badge preview (auto-derived — not editable) */}
        {fields.offerType && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Card badge:</span>
            <span className={[
              'inline-block rounded px-2 py-0.5 text-xs font-bold text-white',
              fields.offerType === 'percentage_discount' ? 'bg-green-700' :
              fields.offerType === 'fixed_discount' ? 'bg-blue-600' :
              fields.offerType === 'loyalty_visits' ? 'bg-teal-600' :
              fields.offerType === 'venue_referral' ? 'bg-amber-600' :
              fields.offerType === 'buy_one_get_one' ? 'bg-purple-600' :
              'bg-orange-500',
            ].join(' ')}>
              {computeValueText(fields.offerType, fields.discountValue) || '—'}
            </span>
          </div>
        )}

        {/* Loyalty stamp-card config */}
        {needsLoyaltyConfig(fields.offerType) && (
          <div className="rounded-lg border border-teal-200 bg-teal-50 p-5 space-y-4">
            <div>
              <p className="text-sm font-semibold text-teal-800">Stamp card configuration</p>
              <p className="text-xs text-teal-600 mt-0.5">
                Members collect one stamp per verified scanner scan. When they reach the target, they claim their reward.
              </p>
            </div>
            {errors.loyaltyConfig && (
              <p className="text-sm text-red-600" role="alert">{errors.loyaltyConfig}</p>
            )}

            <Field label="Stamps required" required hint="Between 2 and 20" error={loyaltyErrors.stampsRequired}>
              <input
                type="number"
                value={loyaltyConfig.stampsRequired}
                onChange={setLoyalty('stampsRequired')}
                min={2} max={20} step={1}
                placeholder="8"
                className={inputCls(!!loyaltyErrors.stampsRequired)}
                disabled={!canEdit || isPending}
              />
            </Field>

            <Field label="Reward description" required hint='What the member receives. e.g. "Free flat white" or "50% off your next meal"' error={loyaltyErrors.rewardDescription}>
              <input
                type="text"
                value={loyaltyConfig.rewardDescription}
                onChange={setLoyalty('rewardDescription')}
                placeholder="e.g. Free flat white"
                maxLength={120}
                className={inputCls(!!loyaltyErrors.rewardDescription)}
                disabled={!canEdit || isPending}
              />
            </Field>

            <Field label="Reward type" required>
              <select
                value={loyaltyConfig.rewardType}
                onChange={setLoyalty('rewardType')}
                className={inputCls(false) + ' cursor-pointer'}
                disabled={!canEdit || isPending}
              >
                {LOYALTY_REWARD_TYPES.map((rt) => (
                  <option key={rt} value={rt}>{LOYALTY_REWARD_TYPE_LABELS[rt]}</option>
                ))}
              </select>
            </Field>

            <Field label="Reward value (optional)" hint='Displayed on the completed card. e.g. "£3.50 value" or "50% off"'>
              <input
                type="text"
                value={loyaltyConfig.rewardValueText}
                onChange={setLoyalty('rewardValueText')}
                placeholder="e.g. £3.50 value"
                maxLength={60}
                className={inputCls(false)}
                disabled={!canEdit || isPending}
              />
            </Field>

            <Field label="Minimum time between stamps" hint="Prevents the same member collecting multiple stamps in quick succession">
              <select
                value={loyaltyConfig.minHoursBetweenStamps}
                onChange={setLoyalty('minHoursBetweenStamps')}
                className={inputCls(false) + ' cursor-pointer'}
                disabled={!canEdit || isPending}
              >
                {STAMP_COOLDOWN_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </Field>

            {/* Live preview of stamp grid */}
            {loyaltyConfig.stampsRequired && parseInt(loyaltyConfig.stampsRequired, 10) >= 2 && (
              <div className="pt-1">
                <p className="text-xs text-teal-600 mb-2">Preview (how members see their progress):</p>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: Math.min(parseInt(loyaltyConfig.stampsRequired, 10), 20) }, (_, i) => (
                    <div
                      key={i}
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs ${
                        i < 3
                          ? 'bg-teal-600 border-teal-600 text-white'
                          : 'border-teal-300 bg-white text-teal-300'
                      }`}
                    >
                      {i < 3 ? '✓' : '○'}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-teal-500 mt-2">
                  3 of {loyaltyConfig.stampsRequired} stamps · {parseInt(loyaltyConfig.stampsRequired, 10) - 3} more until {loyaltyConfig.rewardDescription || 'reward'}
                </p>
              </div>
            )}
          </div>
        )}

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
                'pointer-events-none absolute bottom-2.5 right-3 text-xs tabular-nums',
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

        {/* Cover image */}
        <Field
          label="Cover image"
          hint="Recommended: 1200 × 675 px (16:9). JPG, PNG or WebP. Max 10 MB."
          error={imageError ?? undefined}
        >
          <div className="space-y-2">
            {fields.imageUrl && (
              <div className="relative w-full overflow-hidden rounded-lg border border-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fields.imageUrl}
                  alt="Offer cover"
                  className="w-full object-cover max-h-40"
                />
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setFields((prev) => ({ ...prev, imageUrl: '' }))}
                    className="absolute top-2 right-2 bg-white/90 rounded-full w-6 h-6 flex items-center justify-center text-gray-500 hover:text-red-600 text-xs border border-gray-200"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
            {canEdit && (
              <div>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleImageSelect}
                  disabled={imageUploading || isPending}
                />
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={imageUploading || isPending}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  {imageUploading ? 'Uploading…' : fields.imageUrl ? '🔄 Replace image' : '📷 Upload cover image'}
                </button>
              </div>
            )}
          </div>
        </Field>

        {/* Estimated saving */}
        <Field
          label="Estimated customer saving (£)"
          hint={`Amount saved per redemption in pounds. ${OFFER_TYPE_CONFIG[fields.offerType].savingHint}. Used in the savings screen and analytics.`}
          error={errors.estimatedSavingPence}
        >
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">£</span>
            <input
              type="number"
              value={fields.estimatedSavingPence}
              onChange={set('estimatedSavingPence')}
              placeholder="e.g. 3.50"
              min={0.01}
              step={0.01}
              className={[inputCls(!!errors.estimatedSavingPence), 'pl-7'].join(' ')}
              disabled={!canEdit || isPending}
            />
          </div>
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
