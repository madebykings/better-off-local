import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Billing – Retailer Portal' };

export default function BillingPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Billing</h1>
      {/* TODO: implement Stripe billing portal link, plan status */}
    </div>
  );
}
