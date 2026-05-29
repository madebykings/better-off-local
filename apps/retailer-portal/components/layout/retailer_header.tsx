import { createClient } from '@/lib/supabase/server';
import { AccountMenu } from './account_menu';

export async function RetailerHeader() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-6 shrink-0">
      <div className="text-sm text-gray-500">
        {/* TODO: breadcrumb based on current route */}
      </div>
      <div className="flex items-center gap-3">
        {user?.email && <AccountMenu email={user.email} />}
      </div>
    </header>
  );
}
