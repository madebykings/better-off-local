import {
  requireOnboardingRetailer,
  guardOnboardingStep,
} from '@/lib/auth/require_onboarding_retailer';
import { StepWrapper, StepPlaceholder } from '@/components/onboarding/step_wrapper';

export default async function LocationPage() {
  const { retailer } = await requireOnboardingRetailer();
  guardOnboardingStep('location', retailer?.onboarding_step ?? null);

  return (
    <StepWrapper
      title="Where are you based?"
      subtitle="Members use location to find businesses near them. We're launching in Clackmannanshire first."
    >
      {/* TODO: LocationForm
          Address autocomplete via Google Places API.
          Map preview (static embed) with confirmed pin.
          Area validation: postcode checked against supported_regions table.
          If outside supported area: soft warning, not a hard block.
          "Add another location" expander for multi-site retailers.
          Each location stores: address_line1, town, postcode, lat, lng. */}
      <StepPlaceholder label="Address and map — coming next" />
    </StepWrapper>
  );
}
