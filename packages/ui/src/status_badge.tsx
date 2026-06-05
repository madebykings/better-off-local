const VARIANT_CLASSES: Record<string, string> = {
  // approval
  pending:           'bg-amber-100 text-amber-800 border-amber-200',
  approved:          'bg-green-100 text-green-800 border-green-200',
  rejected:          'bg-red-100 text-red-800 border-red-200',
  suspended:         'bg-gray-200 text-gray-700 border-gray-300',
  changes_requested: 'bg-orange-100 text-orange-700 border-orange-200',
  // offer / content
  live:    'bg-green-100 text-green-800 border-green-200',
  draft:   'bg-gray-100 text-gray-600 border-gray-200',
  paused:  'bg-orange-100 text-orange-800 border-orange-200',
  expired: 'bg-gray-200 text-gray-500 border-gray-300',
  // subscription
  active:   'bg-green-100 text-green-800 border-green-200',
  inactive: 'bg-gray-100 text-gray-500 border-gray-200',
  past_due: 'bg-amber-100 text-amber-800 border-amber-200',
  cancelled:'bg-red-100 text-red-700 border-red-200',
  trialing: 'bg-blue-100 text-blue-800 border-blue-200',
  // venue billing
  free_growth_region: 'bg-blue-50 text-blue-700 border-blue-200',
  paid:               'bg-green-50 text-green-700 border-green-200',
  paid_required:      'bg-amber-50 text-amber-700 border-amber-200',
  admin_waived:       'bg-purple-50 text-purple-700 border-purple-200',
  // redemptions
  success:          'bg-green-100 text-green-800 border-green-200',
  rule_blocked:     'bg-amber-100 text-amber-800 border-amber-200',
  membership_invalid:'bg-red-100 text-red-800 border-red-200',
  // fallback
  none:    'bg-gray-100 text-gray-400 border-gray-200',
};

const DEFAULT_LABELS: Record<string, string> = {
  pending:            'Pending',
  approved:           'Approved',
  rejected:           'Rejected',
  suspended:          'Suspended',
  changes_requested:  'Changes requested',
  live:               'Live',
  draft:              'Draft',
  paused:             'Paused',
  expired:            'Expired',
  active:             'Active',
  inactive:           'Inactive',
  past_due:           'Past due',
  cancelled:          'Cancelled',
  trialing:           'Trialing',
  free_growth_region: 'Free',
  paid:               'Paid',
  paid_required:      'Payment required',
  admin_waived:       'Waived',
  success:            'Redeemed',
  rule_blocked:       'Blocked',
  membership_invalid: 'Membership issue',
  none:               'None',
};

type StatusBadgeProps = {
  status: string;
  label?: string;
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const classes = VARIANT_CLASSES[status] ?? 'bg-gray-100 text-gray-600 border-gray-200';
  const text = label ?? DEFAULT_LABELS[status] ?? status.replace(/_/g, ' ');
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${classes}`}>
      {text}
    </span>
  );
}
