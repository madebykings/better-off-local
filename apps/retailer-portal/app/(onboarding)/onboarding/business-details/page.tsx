import { requireOnboardingUser } from '@/lib/auth/require_onboarding_user';
import { StepWrapper, StepPlaceholder } from '@/components/onboarding/step_wrapper';

export default async function BusinessDetailsPage() {
  await requireOnboardingUser();

  return (
    <StepWrapper
      title="Tell us about your business"
      subtitle="This is what members will see when they discover you on Better Off Local."
    >
      {/* TODO: BusinessDetailsForm
          Fields: business name, tagline (optional), description (~160 chars),
          business type (dropdown), phone number (optional).
          Right panel: live listing card preview updating as user types. */}
      <StepPlaceholder label="Business details form — coming next" />
    </StepWrapper>
  );
}
