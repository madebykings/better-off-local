import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRetailerUser } from '@/lib/auth/require_retailer_user';
import { createServiceClient } from '@/lib/supabase/service';
import { OfferForm } from '../../offers/offer_form';
import type { OfferFields } from '@/lib/actions/offers';

export const metadata: Metadata = { title: 'New Referral Campaign – Retailer Portal' };

const INITIAL_DATA: Partial<OfferFields> = { offerType: 'venue_referral' };

export default async function NewReferralPage() {
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
          <Link href="/referrals" className="hover:text-gray-600 transition-colors">Referrals</Link>
          <span>›</span>
          <span className="text-gray-600">Create referral campaign</span>
        </div>
        <h1 className="text-2xl font-semibold">Create referral campaign</h1>
        <p className="mt-1 text-sm text-gray-500">
          New campaigns are saved as drafts. Submit for approval when ready.
        </p>
      </div>
      <OfferForm
        mode="create"
        locations={locations ?? []}
        initialData={INITIAL_DATA}
      />
    </div>
  );
}
