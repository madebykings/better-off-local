export const ONBOARDING_STEPS = [
  {
    number: 1,
    id: 'business-details' as const,
    label: 'Business',
    path: '/onboarding/business-details',
  },
  {
    number: 2,
    id: 'branding' as const,
    label: 'Branding',
    path: '/onboarding/branding',
  },
  {
    number: 3,
    id: 'categories' as const,
    label: 'Categories',
    path: '/onboarding/categories',
  },
  {
    number: 4,
    id: 'location' as const,
    label: 'Location',
    path: '/onboarding/location',
  },
  {
    number: 5,
    id: 'opening-hours' as const,
    label: 'Hours',
    path: '/onboarding/opening-hours',
  },
  {
    number: 6,
    id: 'links' as const,
    label: 'Links',
    path: '/onboarding/links',
  },
  {
    number: 7,
    id: 'first-offer' as const,
    label: 'First offer',
    path: '/onboarding/first-offer',
  },
  {
    number: 8,
    id: 'preview' as const,
    label: 'Preview',
    path: '/onboarding/preview',
  },
  {
    number: 9,
    id: 'submitted' as const,
    label: 'Submitted',
    path: '/onboarding/submitted',
  },
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]['id'];
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const TOTAL_STEPS = ONBOARDING_STEPS.length;

/**
 * Steps that manage their own Back and Continue navigation internally.
 * OnboardingNav renders null for these so the form's own submit button
 * acts as the Continue action (enabling validation before navigation).
 */
export const FORM_CONTROLLED_STEPS = new Set<OnboardingStepId>([
  'business-details',
]);

export function getStepByPath(pathname: string): OnboardingStep | undefined {
  return ONBOARDING_STEPS.find((s) => s.path === pathname);
}

export function getStepById(id: OnboardingStepId): OnboardingStep | undefined {
  return ONBOARDING_STEPS.find((s) => s.id === id);
}

export function getNextStep(currentId: OnboardingStepId): OnboardingStep | null {
  const current = getStepById(currentId);
  if (!current) return null;
  return ONBOARDING_STEPS.find((s) => s.number === current.number + 1) ?? null;
}

export function getPrevStep(currentId: OnboardingStepId): OnboardingStep | null {
  const current = getStepById(currentId);
  if (!current) return null;
  return ONBOARDING_STEPS.find((s) => s.number === current.number - 1) ?? null;
}
