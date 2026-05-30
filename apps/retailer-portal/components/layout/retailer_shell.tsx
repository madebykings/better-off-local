import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { RetailerShellClient } from './retailer_shell_client';
import type { RetailerAccessRole } from '@/lib/auth/require_retailer_user';

export async function RetailerShell({
  children,
  accessRole,
}: {
  children: React.ReactNode;
  accessRole: RetailerAccessRole;
}) {
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
    <RetailerShellClient
      accessRole={accessRole}
      userEmail={user?.email ?? ''}
      logoUrl={logoUrl}
      retailerName={retailerName}
    >
      {children}
    </RetailerShellClient>
  );
}
