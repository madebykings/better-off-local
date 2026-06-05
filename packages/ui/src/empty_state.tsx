type EmptyStateProps = {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white py-16 px-4 text-center">
      {icon && <p className="text-4xl mb-3" aria-hidden="true">{icon}</p>}
      <p className="font-medium text-gray-700">{title}</p>
      {description && <p className="mt-1 text-sm text-gray-400 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
