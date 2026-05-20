import {
  requireOnboardingRetailer,
  guardOnboardingStep,
} from '@/lib/auth/require_onboarding_retailer';
import { StepWrapper, StepPlaceholder } from '@/components/onboarding/step_wrapper';

export default async function CategoriesPage() {
  const { retailer } = await requireOnboardingRetailer();
  guardOnboardingStep('categories', retailer?.onboarding_step ?? null);

  return (
    <StepWrapper
      title="What kind of business are you?"
      subtitle="Choose the categories that best describe what you offer. Members use these to browse."
    >
      {/* TODO: CategoryPicker
          Multi-select tile grid (2–3 columns).
          Categories sourced from the `categories` table.
          Minimum 1, maximum 3 selections.
          Examples: Food & Drink, Retail, Health & Beauty, Services, Fitness,
          Arts & Culture, Hospitality, Professional Services.
          Selected tiles show filled brand colour. */}
      <StepPlaceholder label="Category picker — coming next" />
    </StepWrapper>
  );
}
