/**
 * Standard content container for onboarding steps.
 *
 * Centres content, constrains width to match the footer nav, and renders
 * a consistent heading + subtitle above the step-specific content.
 */
export function StepWrapper({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 text-[15px] leading-relaxed text-gray-500">
            {subtitle}
          </p>
        )}
      </div>

      {children}
    </div>
  );
}

/**
 * Placeholder used during scaffolding in place of a real form.
 * Remove and replace with the actual form component when implementing each step.
 */
export function StepPlaceholder({ label }: { label: string }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-gray-200 px-8 py-12 text-center">
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  );
}
