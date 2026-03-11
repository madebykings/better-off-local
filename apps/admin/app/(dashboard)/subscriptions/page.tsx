import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Subscriptions – Admin' };

export default function SubscriptionsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Subscriptions</h1>
      {/* TODO: implement consumer and retailer billing inspection */}
    </div>
  );
}
