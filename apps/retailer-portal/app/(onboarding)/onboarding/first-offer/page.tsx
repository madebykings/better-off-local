import {
  requireOnboardingRetailer,
  guardOnboardingStep,
} from '@/lib/auth/require_onboarding_retailer';
import { createServiceClient } from '@/lib/supabase/service';
import { StepWrapper } from '@/components/onboarding/step_wrapper';
import { FirstOfferForm } from '@/components/onboarding/first_offer_form';
import { ruleFromColumns } from '@/lib/utils/redemption_rules';
import {
  EMPTY_OFFER,
  type FirstOfferFields,
  type OfferType,
  OFFER_TYPES,
} from '@/lib/utils/first_offer';

// YYYY-MM-DDTHH:mm:ssZ  →  "YYYY-MM-DD" for <input type="date">
function toDateInput(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

export default async function FirstOfferPage() {
  const { retailer } = await requireOnboardingRetailer();
  guardOnboardingStep('first-offer', retailer?.onboarding_step ?? null);

  let initialFields: FirstOfferFields = { ...EMPTY_OFFER };
  let categorySlugs: string[] = [];

  if (retailer?.id) {
    const service = createServiceClient();

    // ── Pre-fill from existing onboarding offer ─────────────────────────────
    const { data: offer } = await service
      .from('offers')
      .select('id, title, value_text, description, offer_type, start_at, end_at')
      .eq('retailer_id', retailer.id)
      .eq('onboarding_source', 'first-offer')
      .maybeSingle();

    if (offer) {
      const offerType: OfferType = OFFER_TYPES.includes(offer.offer_type as OfferType)
        ? (offer.offer_type as OfferType)
        : 'percentage_discount';

      const { data: rules } = await service
        .from('offer_rules')
        .select(
          'max_redemptions_per_user, max_redemptions_per_day, cooldown_hours, max_redemptions_total',
        )
        .eq('offer_id', offer.id)
        .maybeSingle();

      initialFields = {
        headline:      offer.title ?? '',
        benefitText:   offer.value_text ?? '',
        description:   offer.description ?? '',
        offerType,
        redemptionRule: rules
          ? ruleFromColumns({
              max_redemptions_per_user: rules.max_redemptions_per_user ?? null,
              max_redemptions_per_day:  rules.max_redemptions_per_day  ?? null,
              cooldown_hours:           rules.cooldown_hours            ?? null,
            })
          : 'unlimited',
        startDate: toDateInput(offer.start_at),
        endDate:   toDateInput(offer.end_at),
        totalCap:  rules?.max_redemptions_total != null
          ? String(rules.max_redemptions_total)
          : '',
      };
    }

    // ── Retailer's categories for tap-to-fill suggestions ──────────────────
    const { data: categoryRows } = await service
      .from('retailer_categories')
      .select('categories(slug)')
      .eq('retailer_id', retailer.id);

    categorySlugs = (categoryRows ?? [])
      .map((row) => (row.categories as unknown as { slug: string } | null)?.slug)
      .filter((slug): slug is string => Boolean(slug));
  }

  return (
    <StepWrapper
      title="Create your first offer"
      subtitle="This is the perk members will see when they find you on Better Off Local. Make it something you'd be excited to receive."
    >
      <FirstOfferForm initialFields={initialFields} categorySlugs={categorySlugs} />
    </StepWrapper>
  );
}
