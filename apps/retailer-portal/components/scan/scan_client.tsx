'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { validateRedemption, type RedemptionResult } from '@/lib/actions/validate_redemption';

type ScanState =
  | { phase: 'idle' }
  | { phase: 'scanning' }
  | { phase: 'validating' }
  | { phase: 'result'; result: RedemptionResult }
  | { phase: 'error'; message: string };

/**
 * Client component: accesses the device camera, decodes QR codes via
 * html5-qrcode, then calls the validateRedemption server action.
 *
 * The actual token validation and redemption logging happen entirely on the
 * server — this component only handles camera access and result display.
 */
export function ScanClient() {
  const scannerRef = useRef<InstanceType<typeof import('html5-qrcode')['Html5Qrcode']> | null>(null);
  const [scanState, setScanState] = useState<ScanState>({ phase: 'idle' });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    return () => {
      // Clean up camera on unmount.
      scannerRef.current?.stop().catch(() => null);
    };
  }, []);

  async function startScanning() {
    setScanState({ phase: 'scanning' });

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          // QR detected — stop camera and validate.
          await scanner.stop();
          scannerRef.current = null;
          setScanState({ phase: 'validating' });

          startTransition(async () => {
            try {
              const result = await validateRedemption(decodedText);
              setScanState({ phase: 'result', result });
            } catch {
              setScanState({ phase: 'error', message: 'Validation request failed. Please try again.' });
            }
          });
        },
        () => {
          // QR not found in frame — normal, no-op.
        },
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Camera access failed';
      setScanState({ phase: 'error', message });
    }
  }

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
          <p className="text-gray-500 text-sm">Validating redemption…</p>
        </div>
      )}

      {scanState.phase === 'result' && (
        <ResultCard result={scanState.result} onReset={reset} />
      )}

      {scanState.phase === 'error' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-red-500 text-2xl">⚠️</span>
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

function ResultCard({
  result,
  onReset,
}: {
  result: RedemptionResult;
  onReset: () => void;
}) {
  if (result.success) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-green-600 text-3xl">✅</span>
          <div>
            <p className="font-semibold text-green-800 text-lg">Redemption approved</p>
            {result.memberName && (
              <p className="text-green-700 text-sm">{result.memberName}</p>
            )}
          </div>
        </div>
        {result.offerTitle && (
          <div className="bg-white rounded-md p-3 border border-green-200">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Offer</p>
            <p className="font-medium text-gray-800">{result.offerTitle}</p>
          </div>
        )}
        <button
          onClick={onReset}
          className="w-full bg-green-800 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
        >
          Scan another
        </button>
      </div>
    );
  }

  const statusLabel: Record<string, string> = {
    rejected: 'Rejected',
    expired: 'Code expired',
    rule_blocked: 'Limit reached',
    membership_invalid: 'Membership invalid',
  };

  const label = statusLabel[result.status] ?? 'Not approved';

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6 space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-red-500 text-3xl">❌</span>
        <div>
          <p className="font-semibold text-red-800 text-lg">{label}</p>
        </div>
      </div>
      {result.rejectionReason && (
        <div className="bg-white rounded-md p-3 border border-red-200">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Reason</p>
          <p className="text-gray-800 text-sm">{result.rejectionReason}</p>
        </div>
      )}
      <button
        onClick={onReset}
        className="w-full border border-red-300 text-red-700 py-2 px-4 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
      >
        Scan another
      </button>
    </div>
  );
}
