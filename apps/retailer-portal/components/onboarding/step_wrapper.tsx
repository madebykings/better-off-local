/**
 * Standard content container for onboarding steps.
 *
 * Set `wide` for steps that use a two-column layout (e.g. form + live preview).
 * Defaults to a centred single-column layout (max-w-xl).
 */
export function StepWrapper({
  title,
  subtitle,
  wide = false,
  children,
}: {
  title: string;
  subtitle?: string;
  wide?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`mx-auto w-full ${wide ? 'max-w-5xl' : 'max-w-xl'}`}>
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
