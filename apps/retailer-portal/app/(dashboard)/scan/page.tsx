import type { Metadata } from 'next';
import { ScanClient } from '@/components/scan/scan_client';

export const metadata: Metadata = { title: 'Scan – Retailer Portal' };

/**
 * Scan page: retailer staff scan a consumer's QR code to validate a
 * redemption or verify membership. Camera access and QR decoding happen
 * client-side; all validation and writes happen server-side.
 *
 * The scanner handles both QR types automatically — no mode switching needed.
 */
export default function ScanPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold">Scan member</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">
        Ask the member to open their QR code, then scan it. The result appears
        instantly — no setup or mode selection required.
      </p>
      <ScanClient />
    </div>
  );
}
