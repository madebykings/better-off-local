import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Offers – Admin' };

export default function OffersPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Offers</h1>
      {/* TODO: implement offer review queue with approval/rejection actions */}
    </div>
  );
}
