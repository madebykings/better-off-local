import {
  requireOnboardingRetailer,
  guardOnboardingStep,
} from '@/lib/auth/require_onboarding_retailer';
import { createServiceClient } from '@/lib/supabase/service';
import { StepWrapper } from '@/components/onboarding/step_wrapper';
import { CategoriesForm, type Category } from '@/components/onboarding/categories_form';

export default async function CategoriesPage() {
  const { retailer } = await requireOnboardingRetailer();
  guardOnboardingStep('categories', retailer?.onboarding_step ?? null);

  const service = createServiceClient();

  // All active categories, ordered for the tile grid.
  const { data: categories } = await service
    .from('categories')
    .select('id, name, icon')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  // The retailer's existing selections (empty array on first visit).
  const selectedIds: string[] = [];
  if (retailer?.id) {
    const { data: existing } = await service
      .from('retailer_categories')
      .select('category_id')
      .eq('retailer_id', retailer.id);

    if (existing) {
      selectedIds.push(...existing.map((r) => r.category_id));
    }
  }

  return (
    <StepWrapper
      title="What kind of business are you?"
      subtitle="Choose the categories that best describe what you offer. Members use these to find you."
    >
      <CategoriesForm
        categories={(categories ?? []) as Category[]}
        initialSelectedIds={selectedIds}
      />
    </StepWrapper>
  );
}
