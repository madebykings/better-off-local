type SectionCardProps = {
  title?: string;
  headerAction?: React.ReactNode;
  /** When false the children fill the card without padding. Default: true */
  padding?: boolean;
  children: React.ReactNode;
};

export function SectionCard({ title, headerAction, padding = true, children }: SectionCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
      {(title || headerAction) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          {title && <h2 className="text-sm font-semibold text-gray-700">{title}</h2>}
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      {padding ? <div className="p-5">{children}</div> : <>{children}</>}
    </div>
  );
}
