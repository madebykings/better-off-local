import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRetailerUser } from '@/lib/auth/require_retailer_user';
import { createServiceClient } from '@/lib/supabase/service';
import { NewOfferClient } from './new_offer_client';

export const metadata: Metadata = { title: 'New Offer – Retailer Portal' };

export default async function NewOfferPage() {
  const { retailerId } = await requireRetailerUser();
  const supabase = createServiceClient();

  const { data: locations } = await supabase
    .from('retailer_locations')
    .select('id, name, address_line_1')
    .eq('retailer_id', retailerId)
    .eq('is_active', true)
    .order('is_primary', { ascending: false });

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
          <Link href="/offers" className="hover:text-gray-600 transition-colors">Offers</Link>
          <span>›</span>
          <span className="text-gray-600">New offer</span>
        </div>
        <h1 className="text-2xl font-semibold">Create offer</h1>
        <p className="mt-1 text-sm text-gray-500">
          New offers are saved as drafts. Submit for approval when ready.
        </p>
      </div>
      <NewOfferClient locations={locations ?? []} />
    </div>
  );
}
