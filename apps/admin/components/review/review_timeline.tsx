// ---------------------------------------------------------------------------
// ReviewTimeline
//
// Renders the admin_actions audit log as a vertical timeline.
// Accepts the raw action rows returned by the detail page query.
// ---------------------------------------------------------------------------

type TimelineEntry = {
  id: string;
  action_type: string;
  reason: string | null;
  created_at: string;
  profiles: { full_name: string | null } | null;
};

const ACTION_LABELS: Record<string, string> = {
  retailer_approved:          'Approved',
  retailer_rejected:          'Rejected',
  retailer_suspended:         'Suspended',
  retailer_changes_requested: 'Changes requested',
  retailer_resubmitted:       'Resubmitted',
  retailer_visibility_set_live:   'Set live',
  retailer_visibility_set_hidden: 'Set hidden',
  retailer_visibility_set_draft:  'Set to draft',
};

const ACTION_COLORS: Record<string, { dot: string; label: string }> = {
  retailer_approved:          { dot: 'bg-green-500',  label: 'text-green-700' },
  retailer_rejected:          { dot: 'bg-red-500',    label: 'text-red-700' },
  retailer_suspended:         { dot: 'bg-gray-400',   label: 'text-gray-600' },
  retailer_changes_requested: { dot: 'bg-amber-500',  label: 'text-amber-700' },
  retailer_resubmitted:       { dot: 'bg-blue-500',   label: 'text-blue-700' },
  retailer_visibility_set_live:   { dot: 'bg-green-400', label: 'text-green-600' },
  retailer_visibility_set_hidden: { dot: 'bg-gray-400',  label: 'text-gray-600' },
  retailer_visibility_set_draft:  { dot: 'bg-gray-400',  label: 'text-gray-600' },
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ReviewTimeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Review history</h2>
        <p className="text-sm text-gray-400">No actions recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="mb-4 text-sm font-semibold text-gray-700">Review history</h2>
      <ol className="relative border-l border-gray-200 pl-5 space-y-5">
        {entries.map((entry) => {
          const colors = ACTION_COLORS[entry.action_type] ?? { dot: 'bg-gray-300', label: 'text-gray-600' };
          const label  = ACTION_LABELS[entry.action_type] ?? entry.action_type.replace(/_/g, ' ');

          return (
            <li key={entry.id} className="relative">
              {/* Timeline dot */}
              <span
                className={`absolute -left-[1.35rem] mt-0.5 h-3 w-3 rounded-full border-2 border-white ${colors.dot}`}
              />

              <div className="flex flex-col gap-0.5">
                <span className={`text-sm font-semibold capitalize ${colors.label}`}>
                  {label}
                </span>

                {entry.reason && (
                  <p className="text-sm text-gray-600 italic">&ldquo;{entry.reason}&rdquo;</p>
                )}

                <span className="text-xs text-gray-400">
                  {formatDateTime(entry.created_at)}
                  {entry.profiles?.full_name && (
                    <> &middot; {entry.profiles.full_name}</>
                  )}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
