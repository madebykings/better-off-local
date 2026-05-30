'use client';

import { useState } from 'react';
import { OfferTemplates } from '@/components/offers/offer_templates';
import { OfferForm } from '../offer_form';
import type { OfferFields } from '@/lib/actions/offers';

interface Location {
  id: string;
  name: string | null;
  address_line_1: string | null;
}

interface Props {
  locations: Location[];
}

export function NewOfferClient({ locations }: Props) {
  const [templateOverrides, setTemplateOverrides] = useState<Partial<OfferFields> | undefined>(
    undefined,
  );

  return (
    <>
      <OfferTemplates onApply={(partial) => setTemplateOverrides({ ...partial })} />
      <OfferForm
        key={JSON.stringify(templateOverrides)}
        mode="create"
        locations={locations}
        initialData={templateOverrides}
      />
    </>
  );
}
