import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Audit – Admin' };

export default function AuditPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Audit log</h1>
      {/* TODO: implement audit trail for admin actions and moderation events */}
    </div>
  );
}
