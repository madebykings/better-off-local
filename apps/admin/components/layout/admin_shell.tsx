import { AdminSidebar } from './admin_sidebar';
import { AdminHeader } from './admin_header';
import { ReviewCountBadge } from './review_count_badge';

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      <AdminSidebar reviewBadge={<ReviewCountBadge />} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <AdminHeader />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
