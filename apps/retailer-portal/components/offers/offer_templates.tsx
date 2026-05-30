'use client';

import { useState } from 'react';
import type { OfferFields } from '@/lib/actions/offers';
import type { OfferType } from '@/lib/utils/first_offer';
import type { RedemptionRule } from '@/lib/utils/redemption_rules';

// ---------------------------------------------------------------------------
// Template definitions
// ---------------------------------------------------------------------------

export type OfferTemplate = {
  id: string;
  label: string;
  icon: string;
  description: string;
  offerType: OfferType;
  benefitText: string;
  headline: string;
  offerDescription: string;
  redemptionRule: RedemptionRule;
  placeholder?: {
    benefitText: string;
    headline: string;
  };
};

const TEMPLATES: OfferTemplate[] = [
  {
    id: 'percent_off',
    label: '% Off',
    icon: '%',
    description: 'Percentage discount on purchases',
    offerType: 'percentage_discount',
    benefitText: '10% off',
    headline: '10% off everything, every visit',
    offerDescription:
      'Better Off Local members save 10% on their entire order every visit. Just show your membership card to our team.',
    redemptionRule: 'unlimited',
    placeholder: { benefitText: 'e.g. 10% off', headline: 'e.g. 10% off everything, every visit' },
  },
  {
    id: 'pound_off',
    label: '£ Off',
    icon: '£',
    description: 'Fixed amount off purchases',
    offerType: 'fixed_discount',
    benefitText: '£5 off',
    headline: '£5 off when you spend £20 or more',
    offerDescription:
      'Spend £20 or more and we\'ll take £5 off your bill. Just show your Better Off Local membership when you pay.',
    redemptionRule: 'once_per_day',
    placeholder: { benefitText: 'e.g. £5 off', headline: 'e.g. £5 off when you spend £25 or more' },
  },
  {
    id: 'free_item',
    label: 'Free Item',
    icon: '🎁',
    description: 'A free product or service',
    offerType: 'free_item',
    benefitText: 'Free item',
    headline: 'Free item with every visit',
    offerDescription:
      'Members receive a complimentary item with their visit. Just show your Better Off Local membership to our team.',
    redemptionRule: 'once_per_day',
    placeholder: { benefitText: 'e.g. Free coffee', headline: 'e.g. Free hot drink with any cake' },
  },
  {
    id: 'meal_deal',
    label: 'Meal Deal',
    icon: '🍽️',
    description: 'A bundled food and drink offer',
    offerType: 'other',
    benefitText: 'Meal deal',
    headline: 'Members meal deal — food + drink',
    offerDescription:
      'Enjoy our exclusive members meal deal — a main course and a drink at a special price. Show your membership to our team when you order.',
    redemptionRule: 'once_per_day',
    placeholder: { benefitText: 'e.g. Lunch deal', headline: 'e.g. Sandwich + drink for £7' },
  },
  {
    id: 'bogo',
    label: 'Buy One Get One',
    icon: '2️⃣',
    description: '2-for-1 or buy one get one free',
    offerType: 'other',
    benefitText: '2 for 1',
    headline: 'Buy one, get one free for members',
    offerDescription:
      'Buy one and get a second of equal or lesser value completely free. Show your Better Off Local membership when you order.',
    redemptionRule: 'once_per_day',
    placeholder: { benefitText: 'e.g. 2 for 1', headline: 'e.g. Buy one coffee, get one free' },
  },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface OfferTemplatesProps {
  onApply: (partial: Partial<OfferFields>) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OfferTemplates({ onApply }: OfferTemplatesProps) {
  const [selected, setSelected] = useState<string | null>(null);

  function apply(template: OfferTemplate) {
    setSelected(template.id);
    onApply({
      offerType: template.offerType,
      benefitText: template.benefitText,
      headline: template.headline,
      description: template.offerDescription,
      redemptionRule: template.redemptionRule,
    });
  }

  return (
    <div className="mb-8 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
        Start from a template
      </p>
      <div className="flex flex-wrap gap-2">
        {TEMPLATES.map((t) => (
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
          </button>
        ))}
      </div>
      {selected && (
        <p className="mt-2 text-xs text-gray-400">
          Template applied — edit the fields below to customise.
        </p>
      )}
    </div>
  );
}
