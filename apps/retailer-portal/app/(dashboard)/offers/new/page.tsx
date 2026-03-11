import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'New Offer – Retailer Portal' };

export default function NewOfferPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Create offer</h1>
      {/* TODO: implement offer creation form with server action */}
    </div>
  );
}
