import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Scan – Retailer Portal' };

export default function ScanPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Scan member</h1>
      <p className="text-sm text-gray-500 mt-1">
        Use your camera to scan a member's QR code.
        Validation is handled server-side.
      </p>
      {/* TODO: implement browser camera + QR scanning with server validation */}
    </div>
  );
}
