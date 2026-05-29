import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/require_admin';

export const metadata: Metadata = { title: 'Subscriptions – Admin' };

export default async function SubscriptionsPage() {
  await requireAdmin();
  return (
    <div>
      <h1 className="text-2xl font-semibold">Subscriptions</h1>
      {/* TODO: implement consumer and retailer billing inspection */}
    </div>
  );
}
