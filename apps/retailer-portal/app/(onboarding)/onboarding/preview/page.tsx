import {
  requireOnboardingRetailer,
  guardOnboardingStep,
} from '@/lib/auth/require_onboarding_retailer';
import { createServiceClient } from '@/lib/supabase/service';
import { StepWrapper } from '@/components/onboarding/step_wrapper';
import {
  ListingPreview,
  type PreviewData,
} from '@/components/onboarding/listing_preview';

export default async function PreviewPage() {
  const { retailer } = await requireOnboardingRetailer();
  guardOnboardingStep('preview', retailer?.onboarding_step ?? null);

  // Retailer is always present here — guardOnboardingStep redirects back to
  // the current step before this point if the user has no retailer row.
  if (!retailer?.id) {
    const emptyData: PreviewData = {
      retailer: {
        name: null, tagline: null, description: null,
        logo_url: null, cover_image_url: null, phone: null, email: null,
      },
      categories: [],
      location:   null,
      links:      [],
      offer:      null,
      offerRules: null,
    };
    return (
      <StepWrapper title="This is how members will see you" subtitle="">
        <ListingPreview data={emptyData} />
      </StepWrapper>
    );
  }

  const service = createServiceClient();

  // ── Fetch all preview sections in parallel ──────────────────────────────
  const [
    { data: fullRetailer },
    { data: categoryRows },
    { data: location },
    { data: links },
    { data: offer },
  ] = await Promise.all([
    service
      .from('retailers')
      .select('name, tagline, description, logo_url, cover_image_url, phone, email')
      .eq('id', retailer.id)
      .single(),
    service
      .from('retailer_categories')
      .select('categories(name, slug)')
      .eq('retailer_id', retailer.id),
    service
      .from('retailer_locations')
      .select('address_line_1, address_line_2, town, postcode, opening_hours_json')
      .eq('retailer_id', retailer.id)
      .eq('is_primary', true)
      .maybeSingle(),
    service
      .from('retailer_links')
      .select('type, url')
      .eq('retailer_id', retailer.id),
    service
      .from('offers')
      .select('id, title, value_text, description, offer_type, start_at, end_at')
      .eq('retailer_id', retailer.id)
      .eq('onboarding_source', 'first-offer')
      .maybeSingle(),
  ]);

  // ── Offer rules (sequential — depends on offer.id) ──────────────────────
  let offerRules = null;
  if (offer?.id) {
    const { data: rules } = await service
      .from('offer_rules')
      .select(
        'max_redemptions_per_user, max_redemptions_per_day, cooldown_hours, max_redemptions_total',
      )
      .eq('offer_id', offer.id)
      .maybeSingle();
    offerRules = rules ?? null;
  }

  const previewData: PreviewData = {
    retailer: {
      name:            fullRetailer?.name            ?? null,
      tagline:         fullRetailer?.tagline         ?? null,
      description:     fullRetailer?.description     ?? null,
      logo_url:        fullRetailer?.logo_url        ?? null,
      cover_image_url: fullRetailer?.cover_image_url ?? null,
      phone:           fullRetailer?.phone           ?? null,
      email:           fullRetailer?.email           ?? null,
    },
    categories: (categoryRows ?? [])
      .map((row) => row.categories as unknown as { name: string; slug: string } | null)
      .filter((c): c is { name: string; slug: string } => Boolean(c)),
    location:   location ?? null,
    links:      links    ?? [],
    offer:      offer    ?? null,
    offerRules,
  };

  return (
    <StepWrapper
      title="This is how members will see you"
      subtitle="Review your listing before submitting for approval. Edit any section, then submit when you're ready."
    >
      <ListingPreview data={previewData} />
    </StepWrapper>
  );
}
