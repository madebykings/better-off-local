import { requireOnboardingUser } from '@/lib/auth/require_onboarding_user';
import { StepWrapper } from '@/components/onboarding/step_wrapper';
import { BusinessDetailsForm } from '@/components/onboarding/business_details_form';

export default async function BusinessDetailsPage() {
  await requireOnboardingUser();

  return (
    <StepWrapper
      title="Tell us about your business"
      subtitle="This is what members will see when they discover you on Better Off Local."
      wide
    >
      <BusinessDetailsForm />
    </StepWrapper>
  );
}
