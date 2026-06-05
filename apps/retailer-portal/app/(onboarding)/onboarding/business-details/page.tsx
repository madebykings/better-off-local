import { requireOnboardingRetailer } from '@/lib/auth/require_onboarding_retailer';
import { StepWrapper } from '@/components/onboarding/step_wrapper';
import { BusinessDetailsForm } from '@/components/onboarding/business_details_form';
import type { BusinessDetailsFields } from '@/lib/actions/onboarding';

export default async function BusinessDetailsPage() {
  const { retailer } = await requireOnboardingRetailer();

  // business-details is step 1 — always accessible, no forward-skip guard needed.

  const initialData: BusinessDetailsFields = {
    name: retailer?.name ?? '',
    shortDescription: retailer?.short_description ?? '',
    businessType: retailer?.business_type ?? '',
    phone: retailer?.phone ?? '',
    partnerType: retailer?.partner_type ?? '',
  };

  return (
    <StepWrapper
      title="Tell us about your organisation"
      subtitle="This is what members will see when they discover you on Better Off Local."
      wide
    >
      <BusinessDetailsForm initialData={initialData} />
    </StepWrapper>
  );
}
