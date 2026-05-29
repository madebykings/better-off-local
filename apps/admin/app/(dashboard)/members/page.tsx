import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/require_admin';

export const metadata: Metadata = { title: 'Members – Admin' };

export default async function MembersPage() {
  await requireAdmin();
  return (
    <div>
      <h1 className="text-2xl font-semibold">Members</h1>
      {/* TODO: implement member lookup, membership state visibility */}
    </div>
  );
}
