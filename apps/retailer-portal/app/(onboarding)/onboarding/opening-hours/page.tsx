import {
  requireOnboardingRetailer,
  guardOnboardingStep,
} from '@/lib/auth/require_onboarding_retailer';
import { createServiceClient } from '@/lib/supabase/service';
import { StepWrapper } from '@/components/onboarding/step_wrapper';
import { OpeningHoursForm } from '@/components/onboarding/opening_hours_form';
import { parseOpeningHours, DEFAULT_HOURS } from '@/lib/actions/opening_hours';

export default async function OpeningHoursPage() {
  const { retailer } = await requireOnboardingRetailer();
  guardOnboardingStep('opening-hours', retailer?.onboarding_step ?? null);

  let initialData = DEFAULT_HOURS;

  if (retailer?.id) {
    const service = createServiceClient();
    const { data: location } = await service
      .from('retailer_locations')
      .select('opening_hours_json')
      .eq('retailer_id', retailer.id)
      .eq('is_primary', true)
      .maybeSingle();

    if (location?.opening_hours_json) {
      initialData = parseOpeningHours(location.opening_hours_json);
    }
  }

  return (
    <StepWrapper
      title="When are you open?"
      subtitle="Members check opening hours before visiting. You can update these any time."
    >
      <OpeningHoursForm initialData={initialData} />
    </StepWrapper>
  );
}
