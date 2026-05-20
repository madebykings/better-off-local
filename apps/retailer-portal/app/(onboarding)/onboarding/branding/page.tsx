import {
  requireOnboardingRetailer,
  guardOnboardingStep,
} from '@/lib/auth/require_onboarding_retailer';
import { StepWrapper, StepPlaceholder } from '@/components/onboarding/step_wrapper';

export default async function BrandingPage() {
  const { retailer } = await requireOnboardingRetailer();
  guardOnboardingStep('branding', retailer?.onboarding_step ?? null);

  return (
    <StepWrapper
      title="Add your logo and cover image"
      subtitle="A strong visual identity helps members recognise and trust your business."
    >
      {/* TODO: BrandingForm
          Logo upload: drag & drop or click, min 400×400px, cropped to square.
          Cover image upload: drag & drop or click, min 1200×400px, shown as banner.
          Both uploaded to Supabase Storage; public URLs stored on the retailer record.
          Completion nudge if cover image is skipped ("Listings with cover images
          get significantly more attention"). */}
      <StepPlaceholder label="Logo and cover image upload — coming next" />
    </StepWrapper>
  );
}
