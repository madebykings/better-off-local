import { getAdminContext } from '@/lib/auth/get_admin_context';
import { AccountMenu } from './account_menu';

export async function AdminHeader() {
  const ctx = await getAdminContext();

  return (
    <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-6 shrink-0">
      <div className="text-sm text-gray-500">
        {/* TODO: breadcrumb */}
      </div>
      <div className="flex items-center gap-3">
        {ctx && (
          <AccountMenu email={ctx.email} name={ctx.fullName} />
        )}
      </div>
    </header>
  );
}
