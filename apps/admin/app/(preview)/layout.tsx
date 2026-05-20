import { requireAdmin } from '@/lib/auth/require_admin';

/**
 * Minimal layout for the read-only retailer preview pages.
 * Auth-gated but no admin sidebar — gives an uncluttered consumer-style view.
 */
export default async function PreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8">
      {children}
    </div>
  );
}
