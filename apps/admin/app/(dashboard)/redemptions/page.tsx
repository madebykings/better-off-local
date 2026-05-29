import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/require_admin';

export const metadata: Metadata = { title: 'Redemptions – Admin' };

export default async function RedemptionsPage() {
  await requireAdmin();
  return (
    <div>
      <h1 className="text-2xl font-semibold">Redemptions</h1>
      {/* TODO: implement redemption monitoring, flagged patterns */}
    </div>
  );
}
