import {
  requireOnboardingRetailer,
  guardOnboardingStep,
} from '@/lib/auth/require_onboarding_retailer';
import { StepWrapper } from '@/components/onboarding/step_wrapper';
import { BrandingForm } from '@/components/onboarding/branding_form';

export default async function BrandingPage() {
  const { retailer } = await requireOnboardingRetailer();
  guardOnboardingStep('branding', retailer?.onboarding_step ?? null);

  return (
    <StepWrapper
      title="Add your logo and cover image"
      subtitle="A strong visual identity helps members recognise and trust your business."
      wide
    >
      <BrandingForm
        initialLogoUrl={retailer?.logo_url ?? null}
        initialCoverUrl={retailer?.cover_image_url ?? null}
        retailerName={retailer?.name ?? null}
        retailerTagline={retailer?.tagline ?? null}
        retailerBusinessType={retailer?.business_type ?? null}
      />
    </StepWrapper>
  );
}
