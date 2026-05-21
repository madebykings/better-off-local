'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { validateRedemption, type ScanResult } from '@/lib/actions/validate_redemption';

const RESULT_DISPLAY_SECONDS = 3;

type ScanState =
  | { phase: 'idle' }
  | { phase: 'scanning' }
  | { phase: 'validating' }
  | { phase: 'result'; result: ScanResult }
  | { phase: 'error'; message: string };

/**
 * Client component: accesses the device camera, decodes QR codes via
 * html5-qrcode, then calls the validateRedemption server action.
 *
 * Handles both QR types (offer redemption and membership pass) — the backend
 * resolves the type automatically. No mode switching required.
 *
 * After a result is shown, the scanner automatically restarts after
 * RESULT_DISPLAY_SECONDS seconds. Staff can also tap "Scan now" to skip the
 * countdown.
 */
export function ScanClient() {
  const scannerRef = useRef<InstanceType<typeof import('html5-qrcode')['Html5Qrcode']> | null>(null);
  const [scanState, setScanState] = useState<ScanState>({ phase: 'idle' });
  const [isPending, startTransition] = useTransition();
  const [countdown, setCountdown] = useState<number | null>(null);

  // Holds the attempt ID for the current decoded QR. Generated once per decode
  // and reused on any retry of the same token, so the RPC idempotency cache
  // can return the same result without re-processing. Cleared on a fresh scan.
  const attemptIdRef = useRef<string>(crypto.randomUUID());

  // Keep a stable ref to startScanning so the auto-reset setTimeout can call
  // the latest version without being listed as a useEffect dependency.
  const startScanningRef = useRef<() => void>(() => {});

  const startScanning = useCallback(async () => {
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
          // New UUID per decoded QR. Stored in ref so any retry of this same
          // token reuses the same ID, giving the RPC a cache hit instead of
          // re-processing. A new scan overwrites this with another fresh UUID.
          attemptIdRef.current = crypto.randomUUID();
          setScanState({ phase: 'validating' });

          startTransition(async () => {
            try {
              const result = await validateRedemption(decodedText, attemptIdRef.current);
              setScanState({ phase: 'result', result });
            } catch {
              setScanState({ phase: 'error', message: 'Validation request failed. Please try again.' });
            }
          });
        },
        () => {
          // QR not yet in frame — normal, no-op.
        },
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Camera access failed';
      setScanState({ phase: 'error', message });
    }
  }, []);

  // Keep ref in sync with the latest startScanning closure.
  useEffect(() => {
    startScanningRef.current = startScanning;
  });

  // Stop camera on unmount.
  useEffect(() => {
    return () => {
      scannerRef.current?.stop().catch(() => null);
    };
  }, []);

  // Auto-reset: count down and restart the scanner when a result is shown.
  useEffect(() => {
    if (scanState.phase !== 'result') {
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
    setScanState({ phase: 'idle' });
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Camera viewfinder (html5-qrcode mounts into this div) */}
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
          </p>
          <button
            onClick={startScanning}
            className="w-full bg-green-800 text-white py-3 px-6 rounded-lg font-medium hover:bg-green-700 transition-colors"
          >
            Start scanning
          </button>
        </div>
      )}

      {(scanState.phase === 'validating' || isPending) && (
        <div className="text-center py-12 space-y-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-800 mx-auto" />
          <p className="text-gray-500 text-sm">Validating…</p>
        </div>
      )}

      {scanState.phase === 'result' && (
        <ResultCard
          result={scanState.result}
          countdown={countdown}
          onScanNow={startScanning}
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

// ── Result cards ─────────────────────────────────────────────────────────────

function ScanNextFooter({
  countdown,
  onScanNow,
}: {
  countdown: number | null;
  onScanNow: () => void;
}) {
  return (
    <div className="space-y-2 pt-2">
      <button
        onClick={onScanNow}
        className="w-full bg-green-800 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
      >
        Scan next
      </button>
      {countdown !== null && countdown > 0 && (
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
}: {
  result: ScanResult;
  countdown: number | null;
  onScanNow: () => void;
}) {
  // ── Offer redemption approved ─────────────────────────────────────────────
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
        <ScanNextFooter countdown={countdown} onScanNow={onScanNow} />
      </div>
    );
  }

  // ── Membership pass confirmed ─────────────────────────────────────────────
  if (result.token_type === 'membership_pass' && result.valid) {
    const planLabel =
      result.plan_interval === 'annual' ? 'Annual' :
      result.plan_interval === 'monthly' ? 'Monthly' :
      result.plan_interval.charAt(0).toUpperCase() + result.plan_interval.slice(1);

    const memberSinceLabel = result.member_since
      ? new Date(result.member_since).toLocaleDateString('en-GB', {
          month: 'long',
          year: 'numeric',
        })
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
          {memberSinceLabel && (
            <p className="text-sm text-gray-500">Since {memberSinceLabel}</p>
          )}
        </div>
        <p className="text-sm text-gray-500 text-center">No action required</p>
        <ScanNextFooter countdown={countdown} onScanNow={onScanNow} />
      </div>
    );
  }

  // ── Membership pass invalid ───────────────────────────────────────────────
  if (result.token_type === 'membership_pass' && !result.valid) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-amber-500 text-3xl">✕</span>
          <p className="font-semibold text-amber-800 text-lg">MEMBERSHIP NOT ACTIVE</p>
        </div>
        <div className="bg-white rounded-md p-3 border border-amber-200">
          <p className="text-sm text-gray-700">
            Do not apply any discount. This member&apos;s subscription is not currently active.
          </p>
        </div>
        <ScanNextFooter countdown={countdown} onScanNow={onScanNow} />
      </div>
    );
  }

  // ── Offer redemption rejected ─────────────────────────────────────────────
  if (result.token_type === 'redemption' && !result.valid) {
    return <RedemptionRejectedCard result={result} countdown={countdown} onScanNow={onScanNow} />;
  }

  // ── Unknown / unrecognised token ──────────────────────────────────────────
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
      <ScanNextFooter countdown={countdown} onScanNow={onScanNow} />
    </div>
  );
}

// Extracted to keep ResultCard readable.
function RedemptionRejectedCard({
  result,
  countdown,
  onScanNow,
}: {
  result: Extract<ScanResult, { token_type: 'redemption'; valid: false }>;
  countdown: number | null;
  onScanNow: () => void;
}) {
  const isHard = result.status === 'expired' || result.status === 'rejected';
  const borderColor = isHard ? 'border-red-200' : 'border-amber-200';
  const bgColor = isHard ? 'bg-red-50' : 'bg-amber-50';
  const headingColor = isHard ? 'text-red-800' : 'text-amber-800';
  const iconColor = isHard ? 'text-red-500' : 'text-amber-500';
  const innerBorder = isHard ? 'border-red-200' : 'border-amber-200';

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
    membership_invalid: "This member's subscription is not active.",
    rule_blocked:       result.rejection_reason,
    server_error:       'A server error occurred. Please try scanning again.',
  };

  const heading = headingMap[result.status] ?? 'NOT APPROVED';
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
      <ScanNextFooter countdown={countdown} onScanNow={onScanNow} />
    </div>
  );
}

function formatNextAvailable(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  });
}
