import { requireOnboardingUser } from '@/lib/auth/require_onboarding_user';
import { StepWrapper, StepPlaceholder } from '@/components/onboarding/step_wrapper';

export default async function OpeningHoursPage() {
  await requireOnboardingUser();

  return (
    <StepWrapper
      title="When are you open?"
      subtitle="Members check opening hours before visiting. You can update these any time."
    >
      {/* TODO: OpeningHoursForm
          7-row grid (Mon–Sun). Each row: toggle open/closed + time range pickers.
          Pre-fill with sensible defaults (Mon–Fri 9:00–17:00, Sat–Sun closed).
          "Copy to all days" convenience link.
          "Closed" toggle disables the time pickers for that day.
          Stored as a JSONB hours field on the retailers or locations table. */}
      <StepPlaceholder label="Opening hours grid — coming next" />
    </StepWrapper>
  );
}
