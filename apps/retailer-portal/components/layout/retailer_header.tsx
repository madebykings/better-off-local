import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { AccountMenu } from './account_menu';

export async function RetailerHeader() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let logoUrl: string | null = null;
  let retailerName: string | null = null;

  if (user) {
    const service = createServiceClient();
    const { data: link } = await service
      .from('retailer_users')
      .select('retailer_id')
      .eq('profile_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (link) {
      const { data: retailer } = await service
        .from('retailers')
        .select('logo_url, name')
        .eq('id', link.retailer_id)
        .maybeSingle();
      logoUrl = retailer?.logo_url ?? null;
      retailerName = retailer?.name ?? null;
    }
  }

  return (
    <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-6 shrink-0">
      <div className="text-sm text-gray-500">
        {/* TODO: breadcrumb based on current route */}
      </div>
      <div className="flex items-center gap-3">
        {user?.email && (
          <AccountMenu
            email={user.email}
            logoUrl={logoUrl}
            retailerName={retailerName}
          />
        )}
      </div>
    </header>
  );
}
