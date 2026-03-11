import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Offers – Retailer Portal' };

export default function OffersPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Offers</h1>
        <Link
          href="/offers/new"
          className="text-sm bg-green-800 text-white px-4 py-2 rounded-lg hover:bg-green-700"
        >
          New offer
        </Link>
      </div>
      {/* TODO: implement offer list table */}
    </div>
  );
}
