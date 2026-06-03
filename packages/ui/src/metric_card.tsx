type MetricCardProps = {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  href?: string;
  urgent?: boolean;
};

export function MetricCard({ label, value, icon, href, urgent = false }: MetricCardProps) {
  const cls = [
    'block rounded-lg border p-4',
    urgent ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white',
    href ? 'hover:shadow-sm transition-shadow' : '',
  ].join(' ');

  const body = (
    <>
      {icon && (
        <div className={`mb-2 ${urgent ? 'text-amber-500' : 'text-gray-400'}`}>
          {icon}
        </div>
      )}
      <div className={`text-2xl font-bold tabular-nums ${urgent ? 'text-amber-700' : 'text-gray-900'}`}>
        {value}
      </div>
      <div className="text-xs text-gray-500 mt-1 leading-tight">{label}</div>
      {urgent && (
        <div className="text-xs text-amber-600 font-medium mt-1.5">Needs attention</div>
      )}
    </>
  );

  if (href) return <a href={href} className={cls}>{body}</a>;
  return <div className={cls}>{body}</div>;
}
