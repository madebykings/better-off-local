'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { OfferFields } from '@/lib/actions/offers';
import type { OfferType } from '@/lib/utils/first_offer';
import type { RedemptionRule } from '@/lib/utils/redemption_rules';
import type { OfferMetaFields } from '@/lib/utils/first_offer';

type OfferTemplate = {
  id: string;
  label: string;
  icon: string;
  offerType?: OfferType;
  discountValue?: string;
  headline?: string;
  description?: string;
  redemptionRule?: RedemptionRule;
  offerMeta?: Partial<OfferMetaFields>;
  redirect?: string; // navigate instead of applying to form
};

type BusinessType = 'coffee' | 'restaurant' | 'barber' | 'retail';

const BUSINESS_TYPES: { id: BusinessType; label: string; icon: string }[] = [
  { id: 'coffee',     label: 'Coffee shop / café', icon: '☕' },
  { id: 'restaurant', label: 'Restaurant / pub',   icon: '🍽️' },
  { id: 'barber',     label: 'Barber / salon',      icon: '✂️' },
  { id: 'retail',     label: 'Retail shop',         icon: '🛍️' },
];

const TEMPLATES_BY_TYPE: Record<BusinessType, OfferTemplate[]> = {
  coffee: [
    {
      id: 'coffee_pct',
      label: '10% off every visit',
      icon: '%',
      offerType: 'percentage_discount',
      discountValue: '10',
      headline: '10% off for members, every visit',
      description: 'Better Off Local members enjoy 10% off their order every time they visit. Just show your membership card to our team.',
      redemptionRule: 'unlimited',
      offerMeta: { appliesTo: 'everything' },
    },
    {
      id: 'coffee_free_item',
      label: 'Free coffee with cake',
      icon: '🎁',
      offerType: 'free_item',
      discountValue: '',
      headline: 'Free coffee with any cake slice',
      description: 'Order any slice of cake and we\'ll add a complimentary coffee of your choice. Show your Better Off Local membership when you order.',
      redemptionRule: 'once_per_day',
      offerMeta: { freeItemName: 'coffee', qualifyingPurchase: 'any cake slice' },
    },
    {
      id: 'coffee_bogof',
      label: 'Buy one get one free',
      icon: '2️⃣',
      offerType: 'buy_one_get_one',
      discountValue: '',
      headline: 'Buy one drink, get one free for members',
      description: 'Buy any drink and get a second of equal or lesser value completely free. Show your Better Off Local membership when you order.',
      redemptionRule: 'once_per_day',
      offerMeta: { buyItem: 'any drink', receiveItem: 'second of equal or lesser value' },
    },
    {
      id: 'coffee_loyalty',
      label: 'Loyalty stamp card',
      icon: '🃏',
      redirect: '/loyalty/new',
    },
    {
      id: 'coffee_referral',
      label: 'Refer a friend',
      icon: '🤝',
      redirect: '/referrals/new',
    },
  ],
  restaurant: [
    {
      id: 'rest_pct',
      label: '10% off your bill',
      icon: '%',
      offerType: 'percentage_discount',
      discountValue: '10',
      headline: '10% off your bill for members',
      description: 'Better Off Local members save 10% on their total food and drink bill. Show your membership card to your server.',
      redemptionRule: 'once_per_day',
      offerMeta: { appliesTo: 'food and drink' },
    },
    {
      id: 'rest_fixed',
      label: '£10 off when you spend £40',
      icon: '£',
      offerType: 'fixed_discount',
      discountValue: '10',
      headline: '£10 off when you spend £40 or more',
      description: 'Spend £40 or more on food and drink and we\'ll take £10 off your bill. Show your Better Off Local membership when you pay.',
      redemptionRule: 'once_per_day',
      offerMeta: { minSpend: '40' },
    },
    {
      id: 'rest_starter',
      label: 'Free starter',
      icon: '🎁',
      offerType: 'free_item',
      discountValue: '',
      headline: 'Free starter with your main course',
      description: 'Order a main course and we\'ll add a complimentary starter of your choice. Show your Better Off Local membership when you order.',
      redemptionRule: 'once_per_day',
      offerMeta: { freeItemName: 'starter', qualifyingPurchase: 'any main course' },
    },
    {
      id: 'rest_meal_deal',
      label: 'Members meal deal',
      icon: '🍱',
      offerType: 'meal_deal',
      discountValue: '',
      headline: 'Members lunch meal deal',
      description: 'Enjoy our exclusive members meal deal — main and a soft drink at a special price. Show your membership when you order.',
      redemptionRule: 'once_per_day',
      offerMeta: { includedItems: ['Main course', 'Soft drink'] },
    },
    {
      id: 'rest_referral',
      label: 'Refer a friend',
      icon: '🤝',
      redirect: '/referrals/new',
    },
  ],
  barber: [
    {
      id: 'barber_pct',
      label: '10% off every visit',
      icon: '%',
      offerType: 'percentage_discount',
      discountValue: '10',
      headline: '10% off every visit for members',
      description: 'Better Off Local members save 10% on all services every visit. Show your membership card when you arrive.',
      redemptionRule: 'unlimited',
      offerMeta: { appliesTo: 'all services' },
    },
    {
      id: 'barber_fixed',
      label: '£5 off your cut',
      icon: '£',
      offerType: 'fixed_discount',
      discountValue: '5',
      headline: '£5 off your cut for members',
      description: 'Members save £5 on any standard cut or styling service. Show your Better Off Local membership when you book or arrive.',
      redemptionRule: 'once_per_week',
      offerMeta: {},
    },
    {
      id: 'barber_loyalty',
      label: 'Loyalty stamp card',
      icon: '🃏',
      redirect: '/loyalty/new',
    },
    {
      id: 'barber_referral',
      label: 'Refer a friend',
      icon: '🤝',
      redirect: '/referrals/new',
    },
  ],
  retail: [
    {
      id: 'retail_pct',
      label: '10% off your purchase',
      icon: '%',
      offerType: 'percentage_discount',
      discountValue: '10',
      headline: '10% off for members',
      description: 'Better Off Local members enjoy 10% off everything in store. Just show your membership card when you pay.',
      redemptionRule: 'unlimited',
      offerMeta: { appliesTo: 'all full-price items' },
    },
    {
      id: 'retail_fixed',
      label: '£5 off when you spend £30',
      icon: '£',
      offerType: 'fixed_discount',
      discountValue: '5',
      headline: '£5 off when you spend £30 or more',
      description: 'Spend £30 or more in store and we\'ll take £5 off at the till. Show your Better Off Local membership when you pay.',
      redemptionRule: 'once_per_day',
      offerMeta: { minSpend: '30' },
    },
    {
      id: 'retail_free',
      label: 'Free gift with purchase',
      icon: '🎁',
      offerType: 'free_item',
      discountValue: '',
      headline: 'Free gift with every purchase over £20',
      description: 'Spend £20 or more and choose a free gift. Show your Better Off Local membership at the till.',
      redemptionRule: 'once_per_day',
      offerMeta: { freeItemName: 'gift', qualifyingPurchase: 'any purchase over £20' },
    },
    {
      id: 'retail_special',
      label: 'Members-only deal',
      icon: '⭐',
      offerType: 'other',
      discountValue: '',
      headline: 'Members-only exclusive deal',
      description: 'An exclusive offer available only to Better Off Local members. Show your membership card to redeem.',
      redemptionRule: 'unlimited',
    },
    {
      id: 'retail_referral',
      label: 'Refer a friend',
      icon: '🤝',
      redirect: '/referrals/new',
    },
  ],
};

interface OfferTemplatesProps {
  onApply: (partial: Partial<OfferFields>) => void;
}

export function OfferTemplates({ onApply }: OfferTemplatesProps) {
  const router = useRouter();
  const [businessType, setBusinessType] = useState<BusinessType | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  function apply(template: OfferTemplate) {
    if (template.redirect) {
      router.push(template.redirect);
      return;
    }
    setSelected(template.id);
    onApply({
      offerType: template.offerType,
      discountValue: template.discountValue ?? '',
      headline: template.headline ?? '',
      description: template.description ?? '',
      redemptionRule: template.redemptionRule,
      offerMeta: template.offerMeta as OfferMetaFields | undefined,
    });
  }

  return (
    <div className="mb-8 rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
        Start from a template
      </p>

      {/* Step 1 — business type */}
      {!businessType ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {BUSINESS_TYPES.map((bt) => (
              <button
                key={bt.id}
                type="button"
                onClick={() => setBusinessType(bt.id)}
                className="flex flex-col items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm font-medium text-gray-700 hover:border-green-600 hover:bg-green-50 hover:text-green-800 transition-colors"
              >
                <span className="text-xl leading-none">{bt.icon}</span>
                <span className="text-xs text-center leading-tight">{bt.label}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onApply({})}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Skip — start from blank
          </button>
        </>
      ) : (
        <>
          {/* Step 2 — templates for the selected type */}
          <div className="flex items-center gap-2 mb-1">
            <button
              type="button"
              onClick={() => { setBusinessType(null); setSelected(null); }}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              ← Back
            </button>
            <span className="text-xs text-gray-400">
              {BUSINESS_TYPES.find((bt) => bt.id === businessType)?.icon}{' '}
              {BUSINESS_TYPES.find((bt) => bt.id === businessType)?.label}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {TEMPLATES_BY_TYPE[businessType].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => apply(t)}
                className={[
                  'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                  selected === t.id
                    ? 'border-green-700 bg-green-50 text-green-800'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50',
                ].join(' ')}
              >
                <span className="text-base leading-none">{t.icon}</span>
                <span>{t.label}</span>
                {t.redirect && (
                  <span className="text-xs text-gray-400 ml-0.5">↗</span>
                )}
              </button>
            ))}
          </div>
          {selected && (
            <p className="text-xs text-gray-400">
              Template applied — edit the fields below to customise.
            </p>
          )}
        </>
      )}
    </div>
  );
}
