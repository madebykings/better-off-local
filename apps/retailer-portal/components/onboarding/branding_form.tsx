'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getNextStep, getPrevStep } from '@/lib/onboarding/steps';
import { advanceOnboardingStep } from '@/lib/actions/onboarding';
import { ImageUploadZone } from '@/components/onboarding/image_upload_zone';

const LOGO_MAX_BYTES  = 5 * 1024 * 1024;
const COVER_MAX_BYTES = 10 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Live branding preview — cover + logo composite
// ---------------------------------------------------------------------------

function RetailerBrandingPreview({
  name,
  tagline,
  businessType,
  logoUrl,
  coverUrl,
}: {
  name: string | null;
  tagline: string | null;
  businessType: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-[0_2px_20px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.04]">
      {/* Cover */}
      <div className="relative h-28 overflow-hidden bg-gradient-to-br from-stone-100 to-stone-200">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt="Cover"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              className="h-9 w-9 text-stone-300"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 3h18M3 21h18"
              />
            </svg>
          </div>
        )}
      </div>

      <div className="px-4 pb-5">
        {/* Logo chip */}
        <div className="-mt-5 mb-3 flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white shadow ring-1 ring-black/[0.06]">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="Logo"
              className="h-full w-full object-cover"
            />
          ) : (
            <svg
              className="h-5 w-5 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z"
              />
            </svg>
          )}
        </div>

        {businessType ? (
          <span className="mb-2 inline-block rounded-full bg-brand/[0.08] px-2.5 py-0.5 text-[11px] font-semibold text-brand">
            {businessType}
          </span>
        ) : (
          <div className="mb-2 h-4 w-24 rounded-full bg-gray-100" />
        )}

        {name ? (
          <p className="text-[15px] font-semibold leading-snug text-gray-900">{name}</p>
        ) : (
          <div className="h-4 w-36 rounded bg-gray-100" />
        )}

        {tagline && (
          <p className="mt-1 text-[12px] text-gray-500">{tagline}</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BrandingForm
// ---------------------------------------------------------------------------

export function BrandingForm({
  initialLogoUrl,
  initialCoverUrl,
  retailerName,
  retailerTagline,
  retailerBusinessType,
}: {
  initialLogoUrl: string | null;
  initialCoverUrl: string | null;
  retailerName: string | null;
  retailerTagline: string | null;
  retailerBusinessType: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [logoUrl, setLogoUrl]   = useState<string | null>(initialLogoUrl);
  const [coverUrl, setCoverUrl] = useState<string | null>(initialCoverUrl);
  const [continueError, setContinueError] = useState<string | null>(null);

  function handleBack() {
    const prev = getPrevStep('branding');
    router.push(prev?.path ?? '/dashboard');
  }

  function handleContinue() {
    if (!coverUrl) {
      setContinueError('A cover image is required before continuing.');
      return;
    }
    setContinueError(null);
    startTransition(async () => {
      await advanceOnboardingStep('branding');
      const next = getNextStep('branding');
      if (next) router.push(next.path);
    });
  }

  return (
    <div className="grid grid-cols-1 gap-x-14 gap-y-10 lg:grid-cols-[1fr_320px]">
      {/* ── Upload zones ──────────────────────────────────────────────── */}
      <div className="space-y-8">
        {/* Cover image */}
        <div className="space-y-2">
          <ImageUploadZone
            slot="cover"
            label="Cover image"
            aspectHint="JPG, PNG or WebP · max 10 MB · landscape recommended"
            maxBytes={COVER_MAX_BYTES}
            currentUrl={coverUrl}
            onUploaded={(url) => { setCoverUrl(url); setContinueError(null); }}
            onRemoved={() => setCoverUrl(null)}
          />
          <p className="text-[12px] text-amber-600">
            Required — listings without a cover image get significantly less attention.
          </p>
        </div>

        {/* Logo */}
        <ImageUploadZone
          slot="logo"
          label="Logo"
          aspectHint="JPG, PNG or WebP · max 5 MB · square recommended · optional"
          maxBytes={LOGO_MAX_BYTES}
          currentUrl={logoUrl}
          onUploaded={setLogoUrl}
          onRemoved={() => setLogoUrl(null)}
        />

        {/* Back / Continue */}
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

      {/* ── Live preview ──────────────────────────────────────────────── */}
      <aside className="order-first lg:order-none lg:sticky lg:top-6 lg:self-start">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">
          Live preview
        </p>
        <RetailerBrandingPreview
          name={retailerName}
          tagline={retailerTagline}
          businessType={retailerBusinessType}
          logoUrl={logoUrl}
          coverUrl={coverUrl}
        />
        <p className="mt-2.5 text-center text-[11px] text-gray-400">
          This is how members will see your listing.
        </p>
      </aside>
    </div>
  );
}
