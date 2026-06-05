type GuidanceCardProps = {
  icon?: string;
  heading: string;
  body: string;
  /** Optional CTA link */
  cta?: { label: string; href: string };
};

export function GuidanceCard({ icon, heading, body, cta }: GuidanceCardProps) {
  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3.5">
      <div className="flex items-start gap-3">
        {icon && <span className="text-lg leading-none mt-0.5 shrink-0" aria-hidden="true">{icon}</span>}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-blue-900">{heading}</p>
          <p className="mt-0.5 text-sm text-blue-700 leading-relaxed">{body}</p>
          {cta && (
            <a href={cta.href} className="mt-2 inline-block text-sm font-medium text-blue-800 underline underline-offset-2 hover:text-blue-900">
              {cta.label}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
