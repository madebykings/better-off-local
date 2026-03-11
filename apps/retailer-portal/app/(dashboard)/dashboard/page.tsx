import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Dashboard – Retailer Portal' };

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-sm text-gray-500 mt-1">
        Overview of your account, recent activity, and subscription health.
      </p>
      {/* TODO: implement dashboard metrics cards */}
    </div>
  );
}
