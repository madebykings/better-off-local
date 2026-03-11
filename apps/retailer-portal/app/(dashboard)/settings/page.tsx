import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Settings – Retailer Portal' };

export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Settings</h1>
      {/* TODO: implement account settings (password, email, notifications) */}
    </div>
  );
}
