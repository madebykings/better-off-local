import { RetailerSidebar } from './retailer_sidebar';
import { RetailerHeader } from './retailer_header';
import type { RetailerAccessRole } from '@/lib/auth/require_retailer_user';

export function RetailerShell({
  children,
  accessRole,
}: {
  children: React.ReactNode;
  accessRole: RetailerAccessRole;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <RetailerSidebar accessRole={accessRole} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <RetailerHeader />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
