import {
  requireOnboardingRetailer,
  guardOnboardingStep,
} from '@/lib/auth/require_onboarding_retailer';
import { createServiceClient } from '@/lib/supabase/service';
import { StepWrapper } from '@/components/onboarding/step_wrapper';
import { LocationForm } from '@/components/onboarding/location_form';
import type { LocationFields } from '@/lib/actions/location';

const EMPTY: LocationFields = {
  addressLine1: '',
  addressLine2: '',
  town: '',
  postcode: '',
};

export default async function LocationPage() {
  const { retailer } = await requireOnboardingRetailer();
  guardOnboardingStep('location', retailer?.onboarding_step ?? null);

  let initialData: LocationFields = EMPTY;

  if (retailer?.id) {
    const service = createServiceClient();
    const { data: location } = await service
      .from('retailer_locations')
      .select('address_line_1, address_line_2, town, postcode')
      .eq('retailer_id', retailer.id)
      .eq('is_primary', true)
      .maybeSingle();

    if (location) {
      initialData = {
        addressLine1: location.address_line_1 ?? '',
        addressLine2: location.address_line_2 ?? '',
        town: location.town ?? '',
        postcode: location.postcode ?? '',
      };
    }
  }

  return (
    <StepWrapper
      title="Where are you based?"
      subtitle="Members use location to find businesses near them."
      wide
    >
      <LocationForm initialData={initialData} />
    </StepWrapper>
  );
}
