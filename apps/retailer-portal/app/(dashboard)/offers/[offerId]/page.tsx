import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRetailerUser } from '@/lib/auth/require_retailer_user';
import { createServiceClient } from '@/lib/supabase/service';
import { ruleFromColumns, type RuleColumns } from '@/lib/utils/redemption_rules';
import { OfferForm } from '../offer_form';
import type { OfferFields } from '@/lib/actions/offers';
import { type OfferType, needsDiscountValue } from '@/lib/utils/first_offer';

export const metadata: Metadata = { title: 'Edit Offer – Retailer Portal' };

interface Props {
  params: Promise<{ offerId: string }>;
}

function toDateString(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

export default async function OfferDetailPage({ params }: Props) {
  const { offerId } = await params;
  const { retailerId } = await requireRetailerUser();
  const supabase = createServiceClient();

  const [offerResult, rulesResult, locationsResult, offerLocationsResult] = await Promise.all([
    supabase
      .from('offers')
      .select('id, title, value_text, description, offer_type, start_at, end_at, status, venue_scope, image_url, estimated_saving_pence')
      .eq('id', offerId)
      .eq('retailer_id', retailerId)
      .maybeSingle(),
    supabase
      .from('offer_rules')
      .select('max_redemptions_per_user, max_redemptions_per_day, cooldown_hours, max_redemptions_total, new_customers_only')
      .eq('offer_id', offerId)
      .maybeSingle(),
    supabase
      .from('retailer_locations')
      .select('id, name, address_line_1')
      .eq('retailer_id', retailerId)
      .eq('is_active', true)
      .order('is_primary', { ascending: false }),
    supabase
      .from('offer_locations')
      .select('retailer_location_id')
      .eq('offer_id', offerId),
  ]);

  if (!offerResult.data) notFound();

  const offer = offerResult.data;
  const rules = rulesResult.data;

  const ruleCols: RuleColumns = {
    max_redemptions_per_user: rules?.max_redemptions_per_user ?? null,
    max_redemptions_per_day: rules?.max_redemptions_per_day ?? null,
    cooldown_hours: rules?.cooldown_hours ?? null,
  };

  const venueScope = (offer.venue_scope === 'specific' ? 'specific' : 'all') as OfferFields['venueScope'];
  const selectedLocationIds = (offerLocationsResult.data ?? []).map(
    (ol) => ol.retailer_location_id as string,
  );

  // Parse stored value_text back to a numeric discountValue string for the form.
  // e.g. "10% OFF" → "10",  "£5 OFF" → "5", "FREE ITEM" → ""
  function extractDiscountValue(valueText: string | null, offerType: OfferType): string {
    if (!valueText || !needsDiscountValue(offerType)) return '';
    const pctMatch = valueText.match(/^(\d+(?:\.\d+)?)%/);
    if (pctMatch) return pctMatch[1];
    const gbpMatch = valueText.match(/^£(\d+(?:\.\d+)?)/);
    if (gbpMatch) return gbpMatch[1];
    return '';
  }

  // Map legacy 'bundle' type (DB enum value predating buy_one_get_one) to its
  // current equivalent so the form renders correctly for older offers.
  const rawType = offer.offer_type as string;
  const offerType = (rawType === 'bundle' ? 'buy_one_get_one' : rawType) as OfferFields['offerType'];
  const initialData: OfferFields = {
    headline: offer.title,
    discountValue: extractDiscountValue(offer.value_text, offerType),
    description: offer.description ?? '',
    offerType,
    redemptionRule: ruleFromColumns(ruleCols),
    startDate: toDateString(offer.start_at),
    endDate: toDateString(offer.end_at),
    totalCap: rules?.max_redemptions_total != null ? String(rules.max_redemptions_total) : '',
    newCustomersOnly: rules?.new_customers_only ?? false,
    venueScope,
    selectedLocationIds,
    imageUrl: (offer as any).image_url ?? '',
    estimatedSavingPence: (offer as any).estimated_saving_pence != null
      ? ((offer as any).estimated_saving_pence as number / 100).toFixed(2)
      : '',
  };

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
          <Link href="/offers" className="hover:text-gray-600 transition-colors">Offers</Link>
          <span>›</span>
          <span className="text-gray-600 truncate max-w-[240px]">{offer.title}</span>
        </div>
        <h1 className="text-2xl font-semibold">{offer.title}</h1>
      </div>
      <OfferForm
        mode="edit"
        offerId={offer.id}
        offerStatus={offer.status}
        initialData={initialData}
        locations={locationsResult.data ?? []}
      />
    </div>
  );
}
