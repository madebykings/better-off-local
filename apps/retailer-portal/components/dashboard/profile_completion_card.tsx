import Link from 'next/link';

export type CompletionItem = {
  label: string;
  done: boolean;
  href: string;
};

type ProfileCompletionCardProps = {
  score: number; // 0–100
  items: CompletionItem[];
};

export function ProfileCompletionCard({ score, items }: ProfileCompletionCardProps) {
  // Don't render at all when fully complete
  if (score >= 100) return null;

  const incompleteItems = items.filter((i) => !i.done);
  const displayItems = incompleteItems.length > 0 ? incompleteItems : items;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 mb-6">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700">Profile completeness</h2>
        <span className="text-sm font-semibold text-green-700">{score}%</span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-green-500 rounded-full transition-all duration-300"
          style={{ width: `${score}%` }}
          role="progressbar"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      {/* Incomplete item list */}
      <ul className="space-y-2 mb-4">
        {displayItems.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-sm">
            {item.done ? (
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-green-600 text-xs" aria-hidden="true">
                ✓
              </span>
            ) : (
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-gray-300 text-gray-300 text-xs" aria-hidden="true">
                □
              </span>
            )}
            {item.done ? (
              <span className="text-gray-500 line-through">{item.label}</span>
            ) : (
              <Link
                href={item.href}
                className="text-gray-700 hover:text-green-700 hover:underline"
              >
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ul>

      {/* CTA */}
      <p className="text-xs text-gray-400">
        Complete your profile to go live faster.
      </p>
    </div>
  );
}
