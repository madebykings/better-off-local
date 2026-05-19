import { requireOnboardingUser } from '@/lib/auth/require_onboarding_user';
import { StepWrapper, StepPlaceholder } from '@/components/onboarding/step_wrapper';

export default async function FirstOfferPage() {
  await requireOnboardingUser();

  return (
    <StepWrapper
      title="Create your first offer"
      subtitle="This is the discount or perk members will see when they find you. You can add more after launch."
    >
      {/* TODO: FirstOfferForm — inline card builder, not a traditional form.
          Part A — What's the offer?
            Type: Percentage off / Fixed amount / Free item / Special access
            Title: pre-filled suggestion based on type ("10% off all purchases")
            Details: optional description (shown to members on offer card)

          Part B — Rules (collapsed by default, "Add rules" expander)
            Validity window: optional start and end dates
            Per-member limit: once per member | once per day | unlimited
            Total redemption cap: optional number

          Part C — Live offer card preview (right column or below on mobile)
            Renders exact consumer-facing offer card, updates as user types.

          Creates a row in the `offers` table with status='draft'.
          Offer goes live only after retailer listing is approved and activated. */}
      <StepPlaceholder label="Offer builder — coming next" />
    </StepWrapper>
  );
}
