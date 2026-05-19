'use server';

// ---------------------------------------------------------------------------
// Business Details
// ---------------------------------------------------------------------------

export interface BusinessDetailsFields {
  name: string;
  tagline: string;
  description: string;
  businessType: string;
  phone: string;
}

export interface BusinessDetailsActionResult {
  error?: string;
  fieldErrors?: Partial<Record<keyof BusinessDetailsFields, string>>;
}

/**
 * Persist the business details step for the current retailer.
 *
 * TODO: Implement once the schema is ready:
 *   1. Validate with Zod (server-side, mirrors client validation)
 *   2. requireOnboardingUser() — get userId
 *   3. Upsert the `retailers` row:
 *        - name, tagline, description, business_type, phone
 *        - onboarding_step = 'branding'  ← advance persisted progress
 *   4. Return null on success; return { fieldErrors } on validation failure;
 *      return { error } on unexpected server error.
 *
 * The client navigates to the next step only when this returns null.
 */
export async function saveBusinessDetails(
  _fields: BusinessDetailsFields,
): Promise<BusinessDetailsActionResult | null> {
  // Stub — returns null (success) so client-side navigation fires immediately.
  // Replace with real implementation when ready.
  return null;
}
