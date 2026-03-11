import type { Metadata } from 'next';
import { ScanClient } from '@/components/scan/scan_client';

export const metadata: Metadata = { title: 'Scan – Retailer Portal' };

/**
 * Scan page: retailer staff scan a consumer's QR code to validate and record
 * a redemption. Camera access and QR decoding happen client-side; all
 * validation and logging happen server-side via the validateRedemption action.
 */
export default function ScanPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold">Scan member</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">
        Ask the member to open their offer QR code, then scan it with your
        device camera. Redemption is validated and recorded automatically.
      </p>
      <ScanClient />
    </div>
  );
}
