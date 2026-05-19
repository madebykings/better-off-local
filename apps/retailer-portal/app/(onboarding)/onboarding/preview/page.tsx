import { requireOnboardingUser } from '@/lib/auth/require_onboarding_user';
import { StepWrapper, StepPlaceholder } from '@/components/onboarding/step_wrapper';

export default async function PreviewPage() {
  await requireOnboardingUser();

  return (
    <StepWrapper
      title="This is how members will see you"
      subtitle="Review your listing before submitting for approval. You can edit any section from the dashboard."
    >
      {/* TODO: ListingPreview
          Full read-only render of the consumer-facing retailer detail screen:
            - Cover image banner
            - Logo + name + categories + distance
            - Description
            - Opening hours summary
            - Offers section (draft offer card)
            - Website / social links
          Framed in a mobile-sized container to show the app context.
          Edit links on each section (optional — can be deferred).

          The Continue button in OnboardingNav renders "Submit for review"
          on this step and navigates to /onboarding/submitted. */}
      <StepPlaceholder label="Consumer listing preview — coming next" />
    </StepWrapper>
  );
}
