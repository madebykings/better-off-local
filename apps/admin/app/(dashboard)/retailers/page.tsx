import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Retailers – Admin' };

export default function RetailersPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Retailers</h1>
      {/* TODO: implement retailer list with search, filter by status, approval queue */}
    </div>
  );
}
