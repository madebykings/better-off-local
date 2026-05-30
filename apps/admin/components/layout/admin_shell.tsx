import { getAdminContext } from '@/lib/auth/get_admin_context';
import { ReviewCountBadge } from './review_count_badge';
import { AdminShellClient } from './admin_shell_client';

export async function AdminShell({ children }: { children: React.ReactNode }) {
  const ctx = await getAdminContext();

  return (
    <AdminShellClient
      email={ctx?.email ?? ''}
      name={ctx?.fullName ?? null}
      reviewBadge={<ReviewCountBadge />}
    >
      {children}
    </AdminShellClient>
  );
}
