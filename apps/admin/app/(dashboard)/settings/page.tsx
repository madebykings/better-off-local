import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/require_admin';

export const metadata: Metadata = { title: 'Settings – Admin' };

export default async function SettingsPage() {
  await requireAdmin();
  return (
    <div>
      <h1 className="text-2xl font-semibold">Settings</h1>
      {/* TODO: implement admin settings */}
    </div>
  );
}
