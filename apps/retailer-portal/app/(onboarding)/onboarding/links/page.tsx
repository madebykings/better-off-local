import { requireOnboardingUser } from '@/lib/auth/require_onboarding_user';
import { StepWrapper, StepPlaceholder } from '@/components/onboarding/step_wrapper';

export default async function LinksPage() {
  await requireOnboardingUser();

  return (
    <StepWrapper
      title="Online presence"
      subtitle="Help members find you online. All fields are optional."
    >
      {/* TODO: LinksForm
          Fields (all optional):
            Website URL
            Instagram handle (@...)
            Facebook page URL
            X / Twitter handle (@...)
          Basic URL validation on each field.
          Shown on the consumer retailer detail screen as tappable links. */}
      <StepPlaceholder label="Website and social links — coming next" />
    </StepWrapper>
  );
}
