import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireRetailerUser } from '@/lib/auth/require_retailer_user';
import { RetailerShell } from '@/components/layout/retailer_shell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { accessRole } = await requireRetailerUser();

  // scanner_only staff may only access /scan — redirect everything else.
  if (accessRole === 'scanner_only') {
    const pathname = (await headers()).get('x-pathname') ?? '';
    if (!pathname.startsWith('/scan')) {
      redirect('/scan');
    }
  }

  return <RetailerShell accessRole={accessRole}>{children}</RetailerShell>;
}
