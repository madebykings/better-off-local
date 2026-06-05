import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRetailerUser } from '@/lib/auth/require_retailer_user';
import { createServiceClient } from '@/lib/supabase/service';
import { ruleFromColumns, type RuleColumns } from '@/lib/utils/redemption_rules';
import { OfferForm } from '../../offers/offer_form';
import type { OfferFields } from '@/lib/actions/offers';
import { type OfferType, needsDiscountValue, needsOfferMeta, type LoyaltyConfigFields, EMPTY_LOYALTY_CONFIG, type OfferMetaFields } from '@/lib/utils/first_offer';
import { GuidanceCard } from '@better-off-local/ui';

export const metadata: Metadata = { title: 'Loyalty Programme – Retailer Portal' };

interface Props {
  params: Promise<{ offerId: string }>;
}

function toDateString(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

export default async function LoyaltyProgrammeDetailPage({ params }: Props) {
  const { offerId } = await params;
  const { retailerId } = await requireRetailerUser();
  const supabase = createServiceClient();

  const [offerResult, rulesResult, locationsResult, offerLocationsResult, loyaltyConfigResult] = await Promise.all([
    supabase
      .from('offers')
      .select('id, title, value_text, description, offer_type, start_at, end_at, status, venue_scope, image_url, offer_meta, estimated_saving_pence')
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
    supabase
      .from('offer_loyalty_config')
      .select('stamps_required, reward_description, reward_type, reward_value_text, min_hours_between_stamps')
      .eq('offer_id', offerId)
      .maybeSingle(),
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

  function extractDiscountValue(valueText: string | null, offerType: OfferType): string {
    if (!valueText || !needsDiscountValue(offerType)) return '';
    const pctMatch = valueText.match(/^(\d+(?:\.\d+)?)%/);
    if (pctMatch) return pctMatch[1];
    const gbpMatch = valueText.match(/^£(\d+(?:\.\d+)?)/);
    if (gbpMatch) return gbpMatch[1];
    return '';
  }

  function parseOfferMeta(raw: unknown, offerType: OfferType): OfferMetaFields | undefined {
    if (!raw || !needsOfferMeta(offerType)) return undefined;
    const m = raw as Record<string, unknown>;
    return {
      appliesTo: (m.applies_to as string | undefined) ?? '',
      minSpend: (m.min_spend as string | undefined) ?? '',
      freeItemName: (m.free_item_name as string | undefined) ?? '',
      qualifyingPurchase: (m.qualifying_purchase as string | undefined) ?? '',
      buyItem: (m.buy_item as string | undefined) ?? '',
      receiveItem: (m.receive_item as string | undefined) ?? '',
      bundlePrice: (m.bundle_price as string | undefined) ?? '',
      includedItems: Array.isArray(m.included_items) ? (m.included_items as string[]) : [],
    };
  }

  const rawType = offer.offer_type as string;
  const offerType = (rawType === 'bundle' ? 'buy_one_get_one' : rawType) as OfferFields['offerType'];

  const loyaltyCfgRow = loyaltyConfigResult.data;
  const loyaltyConfig: LoyaltyConfigFields | undefined = loyaltyCfgRow
    ? {
        stampsRequired: String(loyaltyCfgRow.stamps_required),
        rewardDescription: loyaltyCfgRow.reward_description ?? '',
        rewardType: (loyaltyCfgRow.reward_type as LoyaltyConfigFields['rewardType']) ?? 'free_item',
        rewardValueText: loyaltyCfgRow.reward_value_text ?? '',
        minHoursBetweenStamps: String(loyaltyCfgRow.min_hours_between_stamps ?? 0),
      }
    : offerType === 'loyalty_visits'
    ? EMPTY_LOYALTY_CONFIG
    : undefined;

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
    offerMeta: parseOfferMeta((offer as any).offer_meta, offerType),
    loyaltyConfig,
    estimatedSaving: (offer as any).estimated_saving_pence != null
      ? String(((offer as any).estimated_saving_pence / 100).toFixed(2))
      : '',
  };

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
          <Link href="/loyalty" className="hover:text-gray-600 transition-colors">Loyalty</Link>
          <span>›</span>
          <span className="text-gray-600 truncate max-w-[240px]">{offer.title}</span>
        </div>
        <h1 className="text-2xl font-semibold">{offer.title}</h1>
        <p className="text-sm text-gray-500 mt-1">Loyalty programme</p>
      </div>
      <GuidanceCard
        heading="About loyalty programmes"
        body="Your stamp card programme appears in the member app. Members collect stamps on each visit and earn a reward when their card is complete."
      />
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
