import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Dashboard – Admin' };

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-sm text-gray-500 mt-1">
        Platform health, pending approvals, and recent activity.
      </p>
      {/* TODO: implement admin dashboard metrics */}
    </div>
  );
}
