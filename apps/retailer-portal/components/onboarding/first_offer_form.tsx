'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getPrevStep, getNextStep } from '@/lib/onboarding/steps';
import { type RedemptionRule } from '@/lib/utils/redemption_rules';
import {
  OFFER_TYPES,
  type FirstOfferFields,
  type OfferType,
} from '@/lib/utils/first_offer';
import { saveFirstOffer } from '@/lib/actions/first_offer';

// ---------------------------------------------------------------------------
// Offer type config
// ---------------------------------------------------------------------------

const OFFER_TYPE_CONFIG: Record<OfferType, { label: string; hint: string }> = {
  percentage_discount: { label: 'Percentage off',   hint: 'e.g. 10% off' },
  fixed_discount:      { label: 'Fixed amount off', hint: 'e.g. £5 off' },
  free_item:           { label: 'Free item',         hint: 'e.g. Free coffee' },
  buy_one_get_one:     { label: 'Buy one get one',  hint: 'e.g. BOGOF' },
  meal_deal:           { label: 'Meal deal',         hint: 'e.g. Lunch deal' },
  other:               { label: 'Special access',   hint: 'e.g. Members-only event' },
};

const REDEMPTION_RULE_OPTIONS: { value: RedemptionRule; label: string }[] = [
  { value: 'unlimited',       label: 'Unlimited — members can use this any number of times' },
  { value: 'once_per_member', label: 'Once per member' },
  { value: 'once_per_day',    label: 'Once per member per day' },
  { value: 'once_per_week',   label: 'Once per member per week' },
  { value: 'once_per_month',  label: 'Once per member per month' },
];

const REDEMPTION_RULE_SHORT: Record<RedemptionRule, string> = {
  unlimited:       'Unlimited uses',
  once_per_member: 'Once per member',
  once_per_day:    'Once per day',
  once_per_week:   'Once per week',
  once_per_month:  'Once per month',
};

// ---------------------------------------------------------------------------
// Category-based offer suggestions
// ---------------------------------------------------------------------------

type OfferSuggestion = {
  label: string;
  benefitText: string;
  headline: string;
  description: string;
  offerType: OfferType;
};

const CATEGORY_SUGGESTIONS: Record<string, OfferSuggestion[]> = {
  cafes: [
    {
      label: 'Free drink with cake',
      benefitText: 'Free hot drink',
      headline: 'Free hot drink with any cake',
      description: 'Enjoy a complimentary tea, coffee or hot chocolate when you buy any slice of cake. Valid on all cakes at full price.',
      offerType: 'free_item',
    },
    {
      label: '10% off every visit',
      benefitText: '10% off',
      headline: '10% off everything, every visit',
      description: 'Better Off Local members save 10% on their entire order, every time they visit. Just show your membership card to the team.',
      offerType: 'percentage_discount',
    },
    {
      label: 'Free size upgrade',
      benefitText: 'Free size upgrade',
      headline: 'Free size upgrade on all drinks',
      description: 'Upgrade any standard drink to the next size, on us. Show your membership in-store to redeem. Available on all hot and cold drinks.',
      offerType: 'free_item',
    },
  ],
  restaurants: [
    {
      label: '15% off your bill',
      benefitText: '15% off',
      headline: '15% off your total food bill',
      description: 'Dine with us and save 15% off your total food bill. Valid on all food items, dine-in only. Just show your membership when you arrive.',
      offerType: 'percentage_discount',
    },
    {
      label: 'Free dessert',
      benefitText: 'Free dessert',
      headline: 'Free dessert with any main course',
      description: 'Choose any dessert from our menu completely free when you order a main course. Valid for one dessert per member, per visit.',
      offerType: 'free_item',
    },
    {
      label: '£5 off orders over £20',
      benefitText: '£5 off',
      headline: '£5 off when you spend £20 or more',
      description: 'Spend £20 or more on food and drink and we\'ll take £5 off your bill. Just show your Better Off Local membership to the team.',
      offerType: 'fixed_discount',
    },
  ],
  bars: [
    {
      label: '10% off all drinks',
      benefitText: '10% off drinks',
      headline: '10% off all drinks, all night',
      description: 'Members save 10% on their drinks tab all night, every night. Show your membership when you order at the bar.',
      offerType: 'percentage_discount',
    },
    {
      label: 'Free welcome drink',
      benefitText: 'Free drink',
      headline: 'Free welcome drink for members',
      description: 'Start your visit with a complimentary house wine, beer, or soft drink on arrival. Valid once per visit per member.',
      offerType: 'free_item',
    },
    {
      label: '£5 off your tab',
      benefitText: '£5 off',
      headline: '£5 off your drinks tab',
      description: 'Spend £20 or more at the bar and save £5. Show your Better Off Local membership when you pay.',
      offerType: 'fixed_discount',
    },
  ],
  beauty: [
    {
      label: '20% off first visit',
      benefitText: '20% off',
      headline: '20% off your first treatment',
      description: 'New to us? Enjoy 20% off any treatment on your first visit. Valid for all new clients showing a Better Off Local membership.',
      offerType: 'percentage_discount',
    },
    {
      label: 'Free nail art',
      benefitText: 'Free nail art',
      headline: 'Free nail art with any manicure',
      description: 'Book any manicure and we\'ll add a free nail art design of your choice. Just mention your membership when you book or arrive.',
      offerType: 'free_item',
    },
    {
      label: '10% off all treatments',
      benefitText: '10% off',
      headline: '10% off every treatment, every visit',
      description: 'Better Off Local members save 10% on all treatments, every visit. Show your membership when you arrive at the salon.',
      offerType: 'percentage_discount',
    },
  ],
  fitness: [
    {
      label: 'First class free',
      benefitText: 'First class free',
      headline: 'Your first class is on us',
      description: 'New members can try any class completely free. No commitment, no catch — just come and give it a go. Book online or at reception.',
      offerType: 'free_item',
    },
    {
      label: '20% off first month',
      benefitText: '20% off',
      headline: '20% off your first month',
      description: 'Join up and save 20% on your first month\'s membership. Show your Better Off Local card when signing up at reception.',
      offerType: 'percentage_discount',
    },
    {
      label: 'Bring a friend free',
      benefitText: 'Free guest pass',
      headline: 'Bring a friend for free',
      description: 'Bring a friend along for a free one-day guest pass, on us. A great way to share the experience. Valid once per month per member.',
      offerType: 'free_item',
    },
  ],
  shopping: [
    {
      label: '10% off everything',
      benefitText: '10% off',
      headline: '10% off everything in store',
      description: 'Better Off Local members enjoy 10% off all full-priced items in store. Just show your membership card at the till.',
      offerType: 'percentage_discount',
    },
    {
      label: '£5 off when you spend £30',
      benefitText: '£5 off',
      headline: '£5 off when you spend £30 or more',
      description: 'Spend £30 or more and save £5 at the till. Just show your Better Off Local membership to the team when you pay.',
      offerType: 'fixed_discount',
    },
    {
      label: 'Free gift wrapping',
      benefitText: 'Free gift wrapping',
      headline: 'Free gift wrapping on any purchase',
      description: 'We\'ll gift wrap your purchase beautifully, completely free of charge. Just ask at the counter and show your membership card.',
      offerType: 'free_item',
    },
  ],
  services: [
    {
      label: 'Free consultation',
      benefitText: 'Free consultation',
      headline: 'Free initial consultation',
      description: 'Book a free, no-obligation consultation with our team. A great chance to talk through your needs with no commitment required.',
      offerType: 'free_item',
    },
    {
      label: '10% off first booking',
      benefitText: '10% off',
      headline: '10% off your first booking',
      description: 'New customers save 10% on their first booking with us. Show your Better Off Local membership at the time of booking.',
      offerType: 'percentage_discount',
    },
    {
      label: '£10 off first service',
      benefitText: '£10 off',
      headline: '£10 off your first service',
      description: 'Save £10 on your first service with us. Valid for new customers showing a Better Off Local membership on arrival.',
      offerType: 'fixed_discount',
    },
  ],
  health: [
    {
      label: 'Free consultation',
      benefitText: 'Free consultation',
      headline: 'Free initial health consultation',
      description: 'Book a free initial consultation with one of our practitioners. Available to all new patients with a Better Off Local membership.',
      offerType: 'free_item',
    },
    {
      label: '15% off all appointments',
      benefitText: '15% off',
      headline: '15% off all appointments',
      description: 'Better Off Local members save 15% on all appointments. Show your membership when you book or arrive for your appointment.',
      offerType: 'percentage_discount',
    },
    {
      label: '10% off products',
      benefitText: '10% off',
      headline: '10% off all health products',
      description: 'Save 10% on our full range of health products in store. Show your Better Off Local membership card at the counter.',
      offerType: 'percentage_discount',
    },
  ],
  activities: [
    {
      label: 'First session half price',
      benefitText: '50% off',
      headline: 'First session half price',
      description: 'Try us out with your first session at half the normal price. Just show your Better Off Local membership when you arrive.',
      offerType: 'percentage_discount',
    },
    {
      label: 'Free equipment hire',
      benefitText: 'Free equipment hire',
      headline: 'Free equipment hire with every visit',
      description: 'Members get free equipment hire included with every visit. No need to bring your own — just show your membership at reception.',
      offerType: 'free_item',
    },
    {
      label: '10% off all sessions',
      benefitText: '10% off',
      headline: '10% off all activities and sessions',
      description: 'Save 10% on any activity or session when you show your Better Off Local membership at reception. Valid every visit.',
      offerType: 'percentage_discount',
    },
  ],
  'food-drink': [
    {
      label: '10% off food and drink',
      benefitText: '10% off',
      headline: '10% off all food and drink',
      description: 'Better Off Local members save 10% on their entire order every visit. Just show your membership card when you order.',
      offerType: 'percentage_discount',
    },
    {
      label: 'Free side with any main',
      benefitText: 'Free side dish',
      headline: 'Free side dish with any main course',
      description: 'Order any main course and choose a free side dish from our menu. Show your membership to the team when you order.',
      offerType: 'free_item',
    },
    {
      label: '£5 off your order',
      benefitText: '£5 off',
      headline: '£5 off orders over £15',
      description: 'Spend £15 or more and we\'ll take £5 off. Simply show your Better Off Local membership when you order.',
      offerType: 'fixed_discount',
    },
  ],
};

function getSuggestions(categorySlugs: string[]): OfferSuggestion[] {
  const seen = new Set<string>();
  const results: OfferSuggestion[] = [];

  for (const slug of categorySlugs) {
    for (const suggestion of CATEGORY_SUGGESTIONS[slug] ?? []) {
      if (!seen.has(suggestion.label)) {
        seen.add(suggestion.label);
        results.push(suggestion);
      }
    }
  }

  return results.slice(0, 6);
}

// ---------------------------------------------------------------------------
// Urgency badges (computed from form state)
// ---------------------------------------------------------------------------

function getUrgencyBadges(fields: FirstOfferFields): string[] {
  const badges: string[] = ['New'];

  if (fields.totalCap.trim()) {
    badges.push('Limited');
  }

  if (fields.endDate) {
    const end = new Date(fields.endDate);
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    if (end <= sevenDaysFromNow) {
      badges.push('Ends soon');
    }
  }

  return badges;
}

// ---------------------------------------------------------------------------
// Offer card preview
// ---------------------------------------------------------------------------

const OFFER_TYPE_BADGE_CLASS: Record<OfferType, string> = {
  percentage_discount: 'bg-brand/10 text-brand',
  fixed_discount:      'bg-emerald-50 text-emerald-700',
  free_item:           'bg-purple-50 text-purple-700',
  buy_one_get_one:     'bg-violet-50 text-violet-700',
  meal_deal:           'bg-orange-50 text-orange-700',
  other:               'bg-amber-50 text-amber-700',
};

const URGENCY_BADGE_CLASS: Record<string, string> = {
  'New':       'bg-green-500 text-white',
  'Limited':   'bg-orange-500 text-white',
  'Ends soon': 'bg-red-500 text-white',
};

function formatDateShort(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function OfferCardPreview({ fields }: { fields: FirstOfferFields }) {
  const urgencyBadges = getUrgencyBadges(fields);
  const typeConfig = OFFER_TYPE_CONFIG[fields.offerType];
  const isEmpty = !fields.benefitText.trim() && !fields.headline.trim();

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-[0_2px_20px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.04]">
      {/* Card header */}
      <div className="relative bg-gradient-to-br from-brand to-brand/80 px-4 pb-5 pt-4">
        {/* Type + urgency row */}
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${OFFER_TYPE_BADGE_CLASS[fields.offerType]} bg-white/90`}
          >
            {typeConfig.label}
          </span>
          {urgencyBadges.map((badge) => (
            <span
              key={badge}
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${URGENCY_BADGE_CLASS[badge]}`}
            >
              {badge}
            </span>
          ))}
        </div>

        {/* Benefit text — the big hook */}
        <p className="text-2xl font-extrabold leading-tight text-white">
          {fields.benefitText.trim() || (
            <span className="opacity-40">{typeConfig.hint}</span>
          )}
        </p>

        {/* Headline */}
        <p className="mt-1 text-sm font-medium text-white/80">
          {fields.headline.trim() || (
            <span className="opacity-50">Your offer headline</span>
          )}
        </p>
      </div>

      {/* Card body */}
      <div className="px-4 py-3">
        {isEmpty ? (
          <div className="space-y-2 py-1">
            <div className="h-2.5 w-full rounded bg-gray-100" />
            <div className="h-2.5 w-4/5 rounded bg-gray-100" />
          </div>
        ) : (
          <p className="line-clamp-2 text-[12px] leading-relaxed text-gray-500">
            {fields.description.trim() || 'Add a description to complete your offer.'}
          </p>
        )}
      </div>

      {/* Card footer */}
      <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2.5">
        <span className="text-[11px] font-medium text-gray-500">
          {REDEMPTION_RULE_SHORT[fields.redemptionRule]}
        </span>
        {(fields.startDate || fields.endDate) && (
          <span className="text-[11px] text-gray-400">
            {fields.startDate && `From ${formatDateShort(fields.startDate)}`}
            {fields.startDate && fields.endDate && ' · '}
            {fields.endDate && `Until ${formatDateShort(fields.endDate)}`}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Suggestion bar
// ---------------------------------------------------------------------------

function SuggestionBar({
  suggestions,
  onSelect,
}: {
  suggestions: OfferSuggestion[];
  onSelect: (s: OfferSuggestion) => void;
}) {
  if (suggestions.length === 0) return null;

  return (
    <div className="mb-8">
      <p className="mb-2.5 text-xs font-semibold uppercase tracking-widest text-gray-400">
        Quick start — tap to fill
      </p>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => onSelect(s)}
            className="rounded-full border border-brand/30 bg-brand/5 px-3 py-1.5 text-[12px] font-medium
                       text-brand transition-colors hover:bg-brand/10 active:bg-brand/15"
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Input helpers
// ---------------------------------------------------------------------------

const inputCls = (hasError: boolean) =>
  [
    'block w-full rounded-lg border px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-brand/30',
    hasError
      ? 'border-red-300 bg-red-50 focus:border-red-400'
      : 'border-gray-200 bg-white focus:border-brand',
  ].join(' ');

// ---------------------------------------------------------------------------
// FirstOfferForm
// ---------------------------------------------------------------------------

export function FirstOfferForm({
  initialFields,
  categorySlugs,
}: {
  initialFields: FirstOfferFields;
  categorySlugs: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [fields, setFields] = useState<FirstOfferFields>(initialFields);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof FirstOfferFields, string>>
  >({});
  const [continueError, setContinueError] = useState<string | null>(null);

  const suggestions = getSuggestions(categorySlugs);

  function set(key: keyof FirstOfferFields) {
    return (value: string) => {
      setFields((prev) => ({ ...prev, [key]: value }));
      if (fieldErrors[key]) setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
      setContinueError(null);
    };
  }

  function applySuggestion(s: OfferSuggestion) {
    setFields((prev) => ({
      ...prev,
      benefitText: s.benefitText,
      headline:    s.headline,
      description: s.description,
      offerType:   s.offerType,
    }));
    setFieldErrors({});
    setContinueError(null);
  }

  function handleBack() {
    const prev = getPrevStep('first-offer');
    router.push(prev?.path ?? '/onboarding');
  }

  function handleContinue() {
    setContinueError(null);
    startTransition(async () => {
      const result = await saveFirstOffer(fields);

      if (!result) {
        const next = getNextStep('first-offer');
        if (next) router.push(next.path);
        return;
      }

      if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors);
        return;
      }

      if (result.error) {
        setContinueError(result.error);
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-x-14 gap-y-10 lg:grid-cols-[1fr_260px]">
      {/* ── Form ─────────────────────────────────────────────────────── */}
      <div>
        <SuggestionBar suggestions={suggestions} onSelect={applySuggestion} />

        <div className="space-y-6">
          {/* Offer type */}
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Offer type</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {OFFER_TYPES.map((type) => {
                const config = OFFER_TYPE_CONFIG[type];
                const active = fields.offerType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => set('offerType')(type)}
                    disabled={isPending}
                    className={[
                      'rounded-lg border px-3 py-2.5 text-left text-[12px] font-medium transition-colors',
                      active
                        ? 'border-brand bg-brand/5 text-brand'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50',
                    ].join(' ')}
                  >
                    <span className="block font-semibold">{config.label}</span>
                    <span className="mt-0.5 block font-normal text-gray-400">{config.hint}</span>
                  </button>
                );
              })}
            </div>
            {fieldErrors.offerType && (
              <p className="mt-1 text-xs text-red-500" role="alert">{fieldErrors.offerType}</p>
            )}
          </div>

          {/* Benefit text */}
          <div>
            <label htmlFor="benefitText" className="mb-1.5 block text-sm font-medium text-gray-700">
              Benefit <span className="text-xs font-normal text-gray-400">the big hook, e.g. "10% off"</span>
            </label>
            <input
              id="benefitText"
              type="text"
              value={fields.benefitText}
              onChange={(e) => set('benefitText')(e.target.value)}
              placeholder="e.g. 10% off, Free coffee, £5 off"
              disabled={isPending}
              className={inputCls(!!fieldErrors.benefitText)}
            />
            {fieldErrors.benefitText && (
              <p className="mt-1 text-xs text-red-500" role="alert">{fieldErrors.benefitText}</p>
            )}
          </div>

          {/* Headline */}
          <div>
            <label htmlFor="headline" className="mb-1.5 block text-sm font-medium text-gray-700">
              Headline <span className="text-xs font-normal text-gray-400">full offer title</span>
            </label>
            <input
              id="headline"
              type="text"
              value={fields.headline}
              onChange={(e) => set('headline')(e.target.value)}
              placeholder="e.g. 10% off everything, every visit"
              disabled={isPending}
              className={inputCls(!!fieldErrors.headline)}
            />
            {fieldErrors.headline && (
              <p className="mt-1 text-xs text-red-500" role="alert">{fieldErrors.headline}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-gray-700">
              Description / terms
            </label>
            <textarea
              id="description"
              value={fields.description}
              onChange={(e) => set('description')(e.target.value)}
              placeholder="Tell members exactly how to redeem this offer and any conditions that apply."
              rows={3}
              disabled={isPending}
              className={inputCls(!!fieldErrors.description) + ' resize-none'}
            />
            <div className="mt-1 flex items-start justify-between gap-2">
              {fieldErrors.description ? (
                <p className="text-xs text-red-500" role="alert">{fieldErrors.description}</p>
              ) : (
                <span />
              )}
              <span
                className={`flex-shrink-0 text-[11px] tabular-nums ${
                  fields.description.trim().length < 20 ? 'text-gray-400' : 'text-green-600'
                }`}
              >
                {fields.description.trim().length}/20 min
              </span>
            </div>
          </div>

          {/* Redemption rule */}
          <div>
            <label htmlFor="redemptionRule" className="mb-1.5 block text-sm font-medium text-gray-700">
              Redemption limit
            </label>
            <select
              id="redemptionRule"
              value={fields.redemptionRule}
              onChange={(e) => set('redemptionRule')(e.target.value)}
              disabled={isPending}
              className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900
                         focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            >
              {REDEMPTION_RULE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date range */}
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">
              Validity window{' '}
              <span className="text-xs font-normal text-gray-400">optional</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="startDate" className="mb-1 block text-xs text-gray-500">
                  Start date
                </label>
                <input
                  id="startDate"
                  type="date"
                  value={fields.startDate}
                  onChange={(e) => set('startDate')(e.target.value)}
                  disabled={isPending}
                  className={inputCls(false)}
                />
              </div>
              <div>
                <label htmlFor="endDate" className="mb-1 block text-xs text-gray-500">
                  End date
                </label>
                <input
                  id="endDate"
                  type="date"
                  value={fields.endDate}
                  onChange={(e) => set('endDate')(e.target.value)}
                  disabled={isPending}
                  className={inputCls(!!fieldErrors.endDate)}
                />
                {fieldErrors.endDate && (
                  <p className="mt-1 text-xs text-red-500" role="alert">{fieldErrors.endDate}</p>
                )}
              </div>
            </div>
          </div>

          {/* Total cap */}
          <div>
            <label htmlFor="totalCap" className="mb-1.5 block text-sm font-medium text-gray-700">
              Total redemption cap{' '}
              <span className="text-xs font-normal text-gray-400">optional</span>
            </label>
            <p className="mb-2 text-xs text-gray-500">
              Limit the total number of times this offer can be redeemed across all members.
            </p>
            <input
              id="totalCap"
              type="number"
              min="1"
              step="1"
              value={fields.totalCap}
              onChange={(e) => set('totalCap')(e.target.value)}
              placeholder="e.g. 100"
              disabled={isPending}
              className={inputCls(!!fieldErrors.totalCap) + ' w-40'}
            />
            {fieldErrors.totalCap && (
              <p className="mt-1 text-xs text-red-500" role="alert">{fieldErrors.totalCap}</p>
            )}
          </div>

          {/* Pending review nudge */}
          <p className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-[12px] text-blue-700">
            Your offer will be reviewed by the Better Off Local team before going live.
            Most offers are approved within 24 hours.
          </p>

          {/* Back / Continue */}
          <div className="flex items-center justify-between border-t border-gray-100 pt-6">
            <button
              type="button"
              onClick={handleBack}
              disabled={isPending}
              className="text-sm font-medium text-gray-400 transition-colors hover:text-gray-600 disabled:opacity-50"
            >
              &larr; Back
            </button>

            <div className="flex flex-col items-end gap-1.5">
              {continueError && (
                <p className="text-xs text-red-500" role="alert">{continueError}</p>
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
      </div>

      {/* ── Live preview ─────────────────────────────────────────────── */}
      <aside className="order-first lg:order-none lg:sticky lg:top-6 lg:self-start">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">
          Offer card preview
        </p>
        <OfferCardPreview fields={fields} />
        <p className="mt-2.5 text-center text-[11px] text-gray-400">
          This is how members will see your offer.
        </p>
      </aside>
    </div>
  );
}
