import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Redemptions – Admin' };

export default function RedemptionsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Redemptions</h1>
      {/* TODO: implement redemption monitoring, flagged patterns */}
    </div>
  );
}
