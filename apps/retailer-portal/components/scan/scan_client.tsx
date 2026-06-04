'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { validateRedemption, type ScanResult, type LoyaltyOutcome } from '@/lib/actions/validate_redemption';
import { getOffersForPass, redeemViaPass, type PassOffer } from '@/lib/actions/pass_redemption';

const RESULT_DISPLAY_SECONDS = 3;

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

type PassContext = { consumerName: string | null; offers: PassOffer[] };

type ScanState =
  | { phase: 'idle' }
  | { phase: 'scanning' }
  | { phase: 'validating' }
  | { phase: 'offer_chooser' }   // offer list in passContextRef
  | { phase: 'result'; result: ScanResult }
  | { phase: 'error'; message: string };

// ---------------------------------------------------------------------------
// ScanClient
// ---------------------------------------------------------------------------

/**
 * Handles both QR types:
 *  - Offer QR  → validateRedemption → result card (existing path)
 *  - Pass QR   → validateRedemption → getOffersForPass → offer chooser
 *                → retailer selects offer → redeemViaPass → result card
 *
 * The raw token is stored in rawTokenRef so it can be reused in redeemViaPass
 * without re-scanning. The pass context (offers + consumer name) is stored in
 * passContextRef so the chooser can be re-entered after a failed redemption.
 */
export function ScanClient() {
  const scannerRef = useRef<InstanceType<typeof import('html5-qrcode')['Html5Qrcode']> | null>(null);
  const [scanState, setScanState] = useState<ScanState>({ phase: 'idle' });
  const [isPending, startTransition] = useTransition();
  const [countdown, setCountdown] = useState<number | null>(null);

  const rawTokenRef     = useRef<string>('');
  const attemptIdRef    = useRef<string>(crypto.randomUUID());
  const passContextRef  = useRef<PassContext | null>(null);
  const startScanningRef = useRef<() => void>(() => {});

  const startScanning = useCallback(async () => {
    passContextRef.current = null;
    setScanState({ phase: 'scanning' });

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          await scanner.stop();
          scannerRef.current = null;

          rawTokenRef.current  = decodedText.trim();
          attemptIdRef.current = crypto.randomUUID();
          setScanState({ phase: 'validating' });

          startTransition(async () => {
            try {
              const result = await validateRedemption(rawTokenRef.current, attemptIdRef.current);

              // Membership pass — load the offer chooser.
              if (result.token_type === 'membership_pass' && result.valid) {
                const offersResult = await getOffersForPass(rawTokenRef.current);
                if (offersResult.ok) {
                  passContextRef.current = {
                    consumerName: offersResult.consumerName,
                    offers: offersResult.offers,
                  };
                  setScanState({ phase: 'offer_chooser' });
                } else {
                  setScanState({
                    phase: 'error',
                    message: offersResult.error ?? 'Failed to load offers.',
                  });
                }
                return;
              }

              setScanState({ phase: 'result', result });
            } catch {
              setScanState({ phase: 'error', message: 'Validation request failed. Please try again.' });
            }
          });
        },
        () => { /* QR not yet in frame — no-op */ },
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Camera access failed';
      setScanState({ phase: 'error', message });
    }
  }, []);

  useEffect(() => {
    startScanningRef.current = startScanning;
  });

  useEffect(() => {
    return () => {
      scannerRef.current?.stop().catch(() => null);
    };
  }, []);

  // Auto-reset countdown — only for non-pass result cards.
  useEffect(() => {
    if (scanState.phase !== 'result') {
      setCountdown(null);
      return;
    }
    if (passContextRef.current) {
      // Pass-based result: no auto-reset — retailer may want to go back to offers.
      setCountdown(null);
      return;
    }

    setCountdown(RESULT_DISPLAY_SECONDS);
    let remaining = RESULT_DISPLAY_SECONDS;

    const interval = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);

    const timeout = setTimeout(() => {
      startScanningRef.current();
    }, RESULT_DISPLAY_SECONDS * 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [scanState.phase]);

  function reset() {
    scannerRef.current?.stop().catch(() => null);
    scannerRef.current = null;
    passContextRef.current = null;
    setScanState({ phase: 'idle' });
  }

  function handleBackToOffers() {
    setScanState({ phase: 'offer_chooser' });
  }

  function handleOfferSelect(offer: PassOffer) {
    const freshAttemptId = crypto.randomUUID();
    startTransition(async () => {
      try {
        const result = await redeemViaPass(rawTokenRef.current, offer.offerId, freshAttemptId);
        setScanState({ phase: 'result', result });
      } catch {
        setScanState({ phase: 'error', message: 'Redemption request failed. Please try again.' });
      }
    });
  }

  const passCtx = passContextRef.current;

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Camera viewfinder */}
      <div
        id="qr-reader"
        className={
          scanState.phase === 'scanning'
            ? 'w-full rounded-lg overflow-hidden border border-gray-200'
            : 'hidden'
        }
      />

      {scanState.phase === 'idle' && (
        <div className="text-center space-y-4 py-12">
          <div className="text-6xl">📷</div>
          <p className="text-gray-600 text-sm">
            Point the camera at the member&apos;s QR code.
            <br />
            <span className="text-gray-400">Membership card or offer QR both work.</span>
          </p>
          <button
            onClick={startScanning}
            className="w-full bg-green-800 text-white py-3 px-6 rounded-lg font-medium hover:bg-green-700 transition-colors"
          >
            Start scanning
          </button>
        </div>
      )}

      {/* Spinner — covers validating + loading offers + redeeming (isPending) */}
      {(scanState.phase === 'validating' || (scanState.phase === 'offer_chooser' && isPending) || (scanState.phase !== 'offer_chooser' && scanState.phase !== 'result' && isPending)) && (
        <div className="text-center py-12 space-y-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-800 mx-auto" />
          <p className="text-gray-500 text-sm">
            {scanState.phase === 'offer_chooser' ? 'Processing…' : 'Validating…'}
          </p>
        </div>
      )}

      {/* Offer chooser */}
      {scanState.phase === 'offer_chooser' && !isPending && passCtx && (
        <OfferChooserCard
          consumerName={passCtx.consumerName}
          offers={passCtx.offers}
          onSelectOffer={handleOfferSelect}
          onCancel={reset}
        />
      )}

      {/* Result card */}
      {scanState.phase === 'result' && (
        <ResultCard
          result={scanState.result}
          countdown={countdown}
          onScanNow={startScanning}
          onBackToOffers={passCtx ? handleBackToOffers : undefined}
        />
      )}

      {scanState.phase === 'error' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <p className="font-medium text-red-800">Error</p>
          </div>
          <p className="text-red-700 text-sm">{scanState.message}</p>
          <button
            onClick={reset}
            className="w-full border border-red-300 text-red-700 py-2 px-4 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      {scanState.phase === 'scanning' && (
        <button
          onClick={reset}
          className="w-full border border-gray-300 text-gray-700 py-2 px-4 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
        >
          Cancel
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Offer chooser
// ---------------------------------------------------------------------------

function formatAvailabilityState(state: string): string {
  const map: Record<string, string> = {
    offer_expired:              'Offer has ended',
    offer_not_started:          'Not yet started',
    total_cap_reached:          'Redemption cap reached',
    lifetime_used:              'Already used (lifetime limit)',
    daily_cap_reached:          'Daily limit reached',
    retailer_daily_cap_reached: 'Daily retailer limit reached',
    cooldown:                   'Cooldown period active',
    day_restricted:             'Not available today',
    time_restricted:            'Not available at this time',
    new_customers_only:         'New members only',
    retailer_inactive:          'Retailer not active',
    requires_membership:        'Membership required',
  };
  return map[state] ?? state.replace(/_/g, ' ');
}

function OfferChooserCard({
  consumerName,
  offers,
  onSelectOffer,
  onCancel,
}: {
  consumerName: string | null;
  offers: PassOffer[];
  onSelectOffer: (offer: PassOffer) => void;
  onCancel: () => void;
}) {
  const available   = offers.filter((o) => o.availabilityState === 'available');
  const unavailable = offers.filter((o) => o.availabilityState !== 'available');

  return (
    <div className="space-y-4">
      {/* Member verified header */}
      <div className="rounded-lg border border-green-300 bg-green-50 p-4">
        <div className="flex items-center gap-3">
          <span className="text-green-600 text-2xl">✓</span>
          <div>
            <p className="font-semibold text-green-800">MEMBER VERIFIED</p>
            {consumerName && (
              <p className="text-sm text-green-700">{consumerName}</p>
            )}
          </div>
        </div>
      </div>

      {/* Available offers */}
      {available.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">Select an offer to redeem:</p>
          {available.map((offer) => (
            <button
              key={offer.offerId}
              onClick={() => onSelectOffer(offer)}
              className="w-full text-left rounded-lg border border-gray-200 bg-white p-4
                         hover:border-green-400 hover:bg-green-50 active:bg-green-100
                         transition-colors focus:outline-none focus:ring-2 focus:ring-green-700/30"
            >
              {offer.valueText && (
                <p className="text-xl font-bold text-gray-900">{offer.valueText}</p>
              )}
              <p className={`text-sm text-gray-600 ${offer.valueText ? 'mt-0.5' : 'font-medium'}`}>
                {offer.title}
              </p>
              {offer.venueScope === 'specific' && (
                <p className="text-xs text-blue-600 mt-1">Selected venues only</p>
              )}
              <p className="text-xs text-green-700 font-medium mt-2">Tap to redeem →</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
          <p className="text-sm text-gray-500">No offers available for this member right now.</p>
        </div>
      )}

      {/* Unavailable offers */}
      {unavailable.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Not available</p>
          {unavailable.map((offer) => (
            <div key={offer.offerId} className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 opacity-60">
              <p className="text-sm font-medium text-gray-600">{offer.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {formatAvailabilityState(offer.availabilityState)}
              </p>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={onCancel}
        className="w-full border border-gray-300 text-gray-600 py-2 px-4 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
      >
        Cancel — scan next member
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result cards (existing + updated with back button)
// ---------------------------------------------------------------------------

function ScanNextFooter({
  countdown,
  onScanNow,
  onBackToOffers,
}: {
  countdown: number | null;
  onScanNow: () => void;
  onBackToOffers?: () => void;
}) {
  return (
    <div className="space-y-2 pt-2">
      {onBackToOffers && (
        <button
          onClick={onBackToOffers}
          className="w-full bg-green-800 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
        >
          ← Back to offers
        </button>
      )}
      <button
        onClick={onScanNow}
        className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
          onBackToOffers
            ? 'border border-gray-300 text-gray-700 hover:bg-gray-50'
            : 'bg-green-800 text-white hover:bg-green-700'
        }`}
      >
        {onBackToOffers ? 'Scan next member' : 'Scan next'}
      </button>
      {!onBackToOffers && countdown !== null && countdown > 0 && (
        <p className="text-center text-xs text-gray-400">
          Returning to scanner in {countdown}…
        </p>
      )}
    </div>
  );
}

function ResultCard({
  result,
  countdown,
  onScanNow,
  onBackToOffers,
}: {
  result: ScanResult;
  countdown: number | null;
  onScanNow: () => void;
  onBackToOffers?: () => void;
}) {
  if (result.token_type === 'loyalty_stamp') {
    return (
      <LoyaltyResultCard
        result={result}
        countdown={countdown}
        onScanNow={onScanNow}
        onBackToOffers={onBackToOffers}
      />
    );
  }

  if (result.token_type === 'redemption' && result.valid) {
    return (
      <div className="rounded-lg border border-green-300 bg-green-50 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-green-600 text-3xl">✓</span>
          <p className="font-semibold text-green-800 text-lg">APPLY THIS DISCOUNT</p>
        </div>
        <div className="bg-white rounded-md p-4 border border-green-200 text-center">
          {result.benefit_text ? (
            <p className="text-2xl font-bold text-gray-900">{result.benefit_text}</p>
          ) : (
            <p className="text-base text-gray-600 italic">
              Discount confirmed — check your offer details for the amount.
            </p>
          )}
        </div>
        <div className="bg-white rounded-md px-3 py-2 border border-green-200 space-y-2">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Offer</p>
            <p className="text-sm font-medium text-gray-700">{result.offer_title}</p>
          </div>
          {result.consumer_name && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Member</p>
              <p className="text-sm font-medium text-gray-700">{result.consumer_name}</p>
            </div>
          )}
        </div>
        <ScanNextFooter countdown={countdown} onScanNow={onScanNow} onBackToOffers={onBackToOffers} />
      </div>
    );
  }

  if (result.token_type === 'membership_pass' && result.valid) {
    const planLabel =
      result.plan_interval === 'annual'  ? 'Annual'  :
      result.plan_interval === 'monthly' ? 'Monthly' :
      result.plan_interval.charAt(0).toUpperCase() + result.plan_interval.slice(1);

    const memberSinceLabel = result.member_since
      ? new Date(result.member_since).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
      : null;

    return (
      <div className="rounded-lg border border-green-300 bg-green-50 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-green-600 text-3xl">✓</span>
          <p className="font-semibold text-green-800 text-lg">MEMBER VERIFIED</p>
        </div>
        <div className="bg-white rounded-md p-4 border border-green-200 space-y-1">
          <p className="text-sm text-gray-700">Active Better Off Local member</p>
          <p className="text-sm text-gray-700">{planLabel} member</p>
          {memberSinceLabel && <p className="text-sm text-gray-500">Since {memberSinceLabel}</p>}
        </div>
        <p className="text-sm text-gray-500 text-center">No action required</p>
        <ScanNextFooter countdown={countdown} onScanNow={onScanNow} onBackToOffers={onBackToOffers} />
      </div>
    );
  }

  if (result.token_type === 'membership_pass' && !result.valid) {
    const isExpiredQR = !!result.rejection_reason;
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-amber-500 text-3xl">✕</span>
          <p className="font-semibold text-amber-800 text-lg">
            {isExpiredQR ? 'QR CODE EXPIRED' : 'MEMBERSHIP NOT ACTIVE'}
          </p>
        </div>
        <div className="bg-white rounded-md p-3 border border-amber-200">
          <p className="text-sm text-gray-700">
            {isExpiredQR
              ? result.rejection_reason
              : "Do not apply any discount. This member’s subscription is not currently active."}
          </p>
        </div>
        <ScanNextFooter countdown={countdown} onScanNow={onScanNow} onBackToOffers={onBackToOffers} />
      </div>
    );
  }

  if (result.token_type === 'redemption' && !result.valid) {
    return (
      <RedemptionRejectedCard
        result={result}
        countdown={countdown}
        onScanNow={onScanNow}
        onBackToOffers={onBackToOffers}
      />
    );
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6 space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-red-500 text-3xl">✕</span>
        <p className="font-semibold text-red-800 text-lg">QR NOT RECOGNISED</p>
      </div>
      <div className="bg-white rounded-md p-3 border border-red-200">
        <p className="text-sm text-gray-700">Do not apply any discount.</p>
        <p className="text-sm text-gray-500 mt-1">
          {result.token_type === 'unknown' ? result.rejection_reason : 'Invalid QR code.'}
        </p>
      </div>
      <ScanNextFooter countdown={countdown} onScanNow={onScanNow} onBackToOffers={onBackToOffers} />
    </div>
  );
}

function RedemptionRejectedCard({
  result,
  countdown,
  onScanNow,
  onBackToOffers,
}: {
  result: Extract<ScanResult, { token_type: 'redemption'; valid: false }>;
  countdown: number | null;
  onScanNow: () => void;
  onBackToOffers?: () => void;
}) {
  const isHard = result.status === 'expired' || result.status === 'rejected';
  const borderColor  = isHard ? 'border-red-200'   : 'border-amber-200';
  const bgColor      = isHard ? 'bg-red-50'         : 'bg-amber-50';
  const headingColor = isHard ? 'text-red-800'      : 'text-amber-800';
  const iconColor    = isHard ? 'text-red-500'      : 'text-amber-500';
  const innerBorder  = isHard ? 'border-red-200'    : 'border-amber-200';

  const headingMap: Record<string, string> = {
    expired:            'QR CODE EXPIRED',
    rejected:           'ALREADY USED',
    membership_invalid: 'MEMBERSHIP NOT ACTIVE',
    rule_blocked:       'LIMIT REACHED',
    server_error:       'SCAN ERROR',
  };

  const instructionMap: Record<string, string> = {
    expired:            'Ask the member to refresh their app and show a new QR code.',
    rejected:           'This QR code has already been scanned.',
    membership_invalid: "This member’s subscription is not active.",
    rule_blocked:       result.rejection_reason,
    server_error:       'A server error occurred. Please try scanning again.',
  };

  const heading     = headingMap[result.status] ?? 'NOT APPROVED';
  const instruction = instructionMap[result.status] ?? result.rejection_reason;

  const nextAvailableLabel = result.next_available_at
    ? formatNextAvailable(result.next_available_at)
    : null;

  return (
    <div className={`rounded-lg border ${borderColor} ${bgColor} p-6 space-y-4`}>
      <div className="flex items-center gap-3">
        <span className={`${iconColor} text-3xl`}>✕</span>
        <p className={`font-semibold ${headingColor} text-lg`}>{heading}</p>
      </div>
      <div className={`bg-white rounded-md p-3 border ${innerBorder} space-y-2`}>
        <p className="text-sm font-medium text-gray-700">Do not apply any discount.</p>
        <p className="text-sm text-gray-600">{instruction}</p>
        {nextAvailableLabel && (
          <p className="text-sm text-gray-500">Available again: {nextAvailableLabel}</p>
        )}
      </div>
      <ScanNextFooter countdown={countdown} onScanNow={onScanNow} onBackToOffers={onBackToOffers} />
    </div>
  );
}

function formatNextAvailable(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  });
}

// ---------------------------------------------------------------------------
// Loyalty stamp result card
// ---------------------------------------------------------------------------

function LoyaltyStampDots({ earned, required }: { earned: number; required: number }) {
  const capped = Math.min(required, 20);
  return (
    <div className="flex flex-wrap gap-1.5">
      {Array.from({ length: capped }, (_, i) => (
        <div
          key={i}
          className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors ${
            i < earned
              ? 'bg-teal-600 border-teal-600 text-white'
              : 'border-teal-300 bg-white text-teal-300'
          }`}
        >
          {i < earned ? '✓' : ''}
        </div>
      ))}
    </div>
  );
}

function LoyaltyResultCard({
  result,
  countdown,
  onScanNow,
  onBackToOffers,
}: {
  result: Extract<ScanResult, { token_type: 'loyalty_stamp' }>;
  countdown: number | null;
  onScanNow: () => void;
  onBackToOffers?: () => void;
}) {
  if (!result.valid) {
    const nextLabel = result.next_stamp_available_at
      ? formatNextAvailable(result.next_stamp_available_at)
      : null;
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-amber-500 text-3xl">✕</span>
          <p className="font-semibold text-amber-800 text-lg">STAMP NOT ADDED</p>
        </div>
        <div className="bg-white rounded-md p-3 border border-amber-200 space-y-2">
          <p className="text-sm text-gray-700">{result.rejection_reason}</p>
          {nextLabel && (
            <p className="text-sm text-gray-500">Next stamp available: {nextLabel}</p>
          )}
          {result.stamps_earned !== undefined && result.stamps_required !== undefined && (
            <div className="pt-2">
              <p className="text-xs text-gray-400 mb-1.5">Current progress</p>
              <LoyaltyStampDots earned={result.stamps_earned} required={result.stamps_required} />
              <p className="text-xs text-gray-500 mt-1">{result.stamps_earned} of {result.stamps_required} stamps</p>
            </div>
          )}
        </div>
        <ScanNextFooter countdown={countdown} onScanNow={onScanNow} onBackToOffers={onBackToOffers} />
      </div>
    );
  }

  const outcome = result.outcome as LoyaltyOutcome;

  if (outcome === 'reward_claimed') {
    return (
      <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-yellow-600 text-3xl">🎉</span>
          <div>
            <p className="font-semibold text-yellow-800 text-lg">REWARD CLAIMED</p>
            {result.consumer_name && (
              <p className="text-sm text-yellow-700">{result.consumer_name}</p>
            )}
          </div>
        </div>
        <div className="bg-white rounded-md p-4 border border-yellow-200 text-center">
          <p className="text-2xl font-bold text-gray-900">{result.reward_description}</p>
          <p className="text-sm text-gray-500 mt-1">{result.stamps_earned} of {result.stamps_required} stamps collected</p>
        </div>
        <div className="bg-yellow-100 rounded-md px-4 py-3 border border-yellow-200">
          <p className="text-sm font-semibold text-yellow-800">Please give the reward now.</p>
          <p className="text-xs text-yellow-700 mt-0.5">The member's card has been marked as claimed.</p>
        </div>
        <ScanNextFooter countdown={countdown} onScanNow={onScanNow} onBackToOffers={onBackToOffers} />
      </div>
    );
  }

  if (outcome === 'already_claimed') {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-3xl">✓</span>
          <p className="font-semibold text-gray-600 text-lg">REWARD ALREADY CLAIMED</p>
        </div>
        <div className="bg-white rounded-md p-3 border border-gray-200">
          <p className="text-sm text-gray-600">This member has already collected their {result.reward_description}. Their card is complete.</p>
        </div>
        <ScanNextFooter countdown={countdown} onScanNow={onScanNow} onBackToOffers={onBackToOffers} />
      </div>
    );
  }

  if (outcome === 'completed') {
    return (
      <div className="rounded-lg border border-teal-300 bg-teal-50 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-teal-600 text-3xl">⭐</span>
          <div>
            <p className="font-semibold text-teal-800 text-lg">STAMP CARD COMPLETE!</p>
            {result.consumer_name && (
              <p className="text-sm text-teal-700">{result.consumer_name}</p>
            )}
          </div>
        </div>
        <div className="bg-white rounded-md p-4 border border-teal-200 space-y-3">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{result.reward_description}</p>
            <p className="text-sm text-gray-500 mt-1">All {result.stamps_required} stamps collected</p>
          </div>
          <LoyaltyStampDots earned={result.stamps_earned} required={result.stamps_required} />
        </div>
        <div className="bg-teal-100 rounded-md px-4 py-3 border border-teal-200">
          <p className="text-sm font-semibold text-teal-800">Reward unlocked!</p>
          <p className="text-xs text-teal-700 mt-0.5">
            The member will present their QR code again to claim. When they do, give them their {result.reward_description}.
          </p>
        </div>
        <ScanNextFooter countdown={countdown} onScanNow={onScanNow} onBackToOffers={onBackToOffers} />
      </div>
    );
  }

  // outcome === 'stamped'
  const remaining = result.stamps_required - result.stamps_earned;
  return (
    <div className="rounded-lg border border-teal-300 bg-teal-50 p-6 space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-teal-600 text-3xl">✓</span>
        <div>
          <p className="font-semibold text-teal-800 text-lg">
            STAMP {result.stamps_earned} OF {result.stamps_required} ADDED
          </p>
          {result.consumer_name && (
            <p className="text-sm text-teal-700">{result.consumer_name}</p>
          )}
        </div>
      </div>
      <div className="bg-white rounded-md p-4 border border-teal-200 space-y-3">
        <LoyaltyStampDots earned={result.stamps_earned} required={result.stamps_required} />
        <p className="text-sm text-gray-600">
          {remaining} more {remaining === 1 ? 'stamp' : 'stamps'} until {result.reward_description}
        </p>
      </div>
      <ScanNextFooter countdown={countdown} onScanNow={onScanNow} onBackToOffers={onBackToOffers} />
    </div>
  );
}
