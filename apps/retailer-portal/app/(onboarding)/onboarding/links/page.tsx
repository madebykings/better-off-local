import {
  requireOnboardingRetailer,
  guardOnboardingStep,
} from '@/lib/auth/require_onboarding_retailer';
import { createServiceClient } from '@/lib/supabase/service';
import { StepWrapper } from '@/components/onboarding/step_wrapper';
import { LinksForm } from '@/components/onboarding/links_form';
import { URL_LINK_TYPES, type UrlLinkType, reverseNormaliseLink } from '@/lib/utils/links';
import { type LinksFields } from '@/lib/actions/links';

export default async function LinksPage() {
  const { retailer } = await requireOnboardingRetailer();
  guardOnboardingStep('links', retailer?.onboarding_step ?? null);

  const initialFields: LinksFields = {
    website: '',
    instagram: '',
    facebook: '',
    tiktok: '',
    whatsapp: '',
    phone: '',
    email: '',
    preferredContactType: '',
  };

  if (retailer?.id) {
    const service = createServiceClient();

    // Load phone, email, preferred_contact_type from retailers
    const { data: retailerRow } = await service
      .from('retailers')
      .select('phone, email, preferred_contact_type')
      .eq('id', retailer.id)
      .single();

    if (retailerRow) {
      initialFields.phone = retailerRow.phone ?? '';
      initialFields.email = retailerRow.email ?? '';
      initialFields.preferredContactType = retailerRow.preferred_contact_type ?? '';
    }

    // Load URL-based links from retailer_links
    const { data: links } = await service
      .from('retailer_links')
      .select('type, url')
      .eq('retailer_id', retailer.id)
      .in('type', URL_LINK_TYPES as unknown as string[]);

    for (const link of links ?? []) {
      const type = link.type as UrlLinkType;
      if (URL_LINK_TYPES.includes(type)) {
        initialFields[type] = reverseNormaliseLink(type, link.url);
      }
    }
  }

  return (
    <StepWrapper
      title="Online presence"
      subtitle="Help members find and contact you. All fields are optional."
    >
      <LinksForm initialFields={initialFields} />
    </StepWrapper>
  );
}
