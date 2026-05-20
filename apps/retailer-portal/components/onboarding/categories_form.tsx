'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getPrevStep, getNextStep } from '@/lib/onboarding/steps';
import { saveRetailerCategories } from '@/lib/actions/categories';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Category = {
  id: string;
  name: string;
  icon: string | null;
};

// ---------------------------------------------------------------------------
// Icon map — Heroicons v2 outline (24 × 24 viewBox)
// Each entry is an array of SVG path `d` values; some icons use multiple paths.
// ---------------------------------------------------------------------------

const ICON_PATHS: Record<string, string[]> = {
  // Cafes → BuildingStorefrontIcon
  coffee: [
    'M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z',
  ],
  // Restaurants → FireIcon
  utensils: [
    'M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z',
    'M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z',
  ],
  // Bars → BeakerIcon
  beer: [
    'M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5',
  ],
  // Beauty → SparklesIcon
  sparkles: [
    'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z',
  ],
  // Fitness → BoltIcon
  dumbbell: [
    'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z',
  ],
  // Shopping → ShoppingBagIcon
  'shopping-bag': [
    'M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z',
  ],
  // Services → WrenchScrewdriverIcon
  wrench: [
    'M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z',
  ],
  // Health → HeartIcon
  heart: [
    'M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z',
  ],
  // Activities → MapPinIcon
  map: [
    'M15 10.5a3 3 0 11-6 0 3 3 0 016 0z',
    'M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z',
  ],
  // Food & Drink → CakeIcon
  'fork-knife': [
    'M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.87c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513m-3-4.87v-1.5m-6 1.5v-1.5m12 9.75l-1.5.75a3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0L3 16.5m15-3.38a48.474 48.474 0 00-6-.37c-2.032 0-4.034.125-6 .37m12 0c.39.049.777.102 1.163.16 1.07.16 1.837 1.094 1.837 2.175v5.17c0 .62-.504 1.124-1.125 1.124H4.125A1.125 1.125 0 013 20.625v-5.17c0-1.08.768-2.014 1.837-2.174A47.78 47.78 0 016 13.12M12.265 3.11a.375.375 0 11-.53 0L12 2.845l.265.265zm-3 0a.375.375 0 11-.53 0L9 2.845l.265.265zm6 0a.375.375 0 11-.53 0L15 2.845l.265.265z',
  ],
};

// Fallback → TagIcon
const FALLBACK_PATHS = [
  'M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z',
  'M6 6h.008v.008H6V6z',
];

const MAX_SELECTIONS = 3;

// ---------------------------------------------------------------------------
// CategoryIcon
// ---------------------------------------------------------------------------

function CategoryIcon({
  iconSlug,
  className,
}: {
  iconSlug: string | null;
  className?: string;
}) {
  const paths = (iconSlug && ICON_PATHS[iconSlug]) ?? FALLBACK_PATHS;
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      {paths.map((d, i) => (
        <path key={i} strokeLinecap="round" strokeLinejoin="round" d={d} />
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// CategoriesForm
// ---------------------------------------------------------------------------

export function CategoriesForm({
  categories,
  initialSelectedIds,
}: {
  categories: Category[];
  initialSelectedIds: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(initialSelectedIds),
  );
  const [continueError, setContinueError] = useState<string | null>(null);
  const [maxError, setMaxError] = useState(false);

  function handleToggle(id: string) {
    setSelectedIds((prev) => {
      if (prev.has(id)) {
        // Deselecting — always allowed; clear max error if it was showing.
        setMaxError(false);
        const next = new Set(prev);
        next.delete(id);
        return next;
      }
      if (prev.size >= MAX_SELECTIONS) {
        setMaxError(true);
        return prev; // no change
      }
      setMaxError(false);
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    // Clear the "select at least one" error on any interaction.
    setContinueError(null);
  }

  function handleBack() {
    const prev = getPrevStep('categories');
    router.push(prev?.path ?? '/onboarding');
  }

  function handleContinue() {
    if (selectedIds.size === 0) {
      setContinueError('Please select at least one category before continuing.');
      return;
    }
    setContinueError(null);
    startTransition(async () => {
      const result = await saveRetailerCategories(Array.from(selectedIds));
      if (result?.error) {
        setContinueError(result.error);
        return;
      }
      const next = getNextStep('categories');
      if (next) router.push(next.path);
    });
  }

  const count = selectedIds.size;

  return (
    <div className="space-y-8">
      {/* ── Counter ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Selected:{' '}
          <span className={count > 0 ? 'font-semibold text-gray-800' : ''}>
            {count} of {MAX_SELECTIONS}
          </span>
        </p>
        {maxError && (
          <p className="text-sm font-medium text-amber-600" role="alert">
            Maximum {MAX_SELECTIONS} categories
          </p>
        )}
      </div>

      {/* ── Tile grid ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {categories.map((category) => {
          const isSelected = selectedIds.has(category.id);
          const isDisabled = isPending || (!isSelected && count >= MAX_SELECTIONS);

          return (
            <button
              key={category.id}
              type="button"
              onClick={() => !isPending && handleToggle(category.id)}
              aria-pressed={isSelected}
              disabled={isPending}
              className={[
                'flex flex-col items-center gap-2.5 rounded-xl border-2 px-3 py-4 text-center transition-all',
                isSelected
                  ? 'border-brand bg-brand text-white shadow-sm'
                  : isDisabled
                  ? 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-brand/40 hover:bg-brand/5 hover:text-brand',
              ].join(' ')}
            >
              <CategoryIcon
                iconSlug={category.icon}
                className="h-6 w-6 flex-shrink-0"
              />
              <span className="text-[13px] font-medium leading-tight">
                {category.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Back / Continue ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-6">
        <button
          type="button"
          onClick={handleBack}
          disabled={isPending}
          className="text-sm font-medium text-gray-400 transition-colors hover:text-gray-600 disabled:opacity-50"
        >
          ← Back
        </button>

        <div className="flex flex-col items-end gap-1.5">
          {continueError && (
            <p className="text-xs text-red-500" role="alert">
              {continueError}
            </p>
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
  );
}
