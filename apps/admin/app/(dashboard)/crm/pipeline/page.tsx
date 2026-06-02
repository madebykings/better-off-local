import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';
import { PipelineBoard, type CrmBizRow } from '@/components/crm/pipeline_board';

export const metadata: Metadata = { title: 'Growth CRM – Admin' };

const STAGE_ORDER = [
  'lead','contacted','interested','meeting_booked',
  'onboarding','awaiting_content','awaiting_offer',
  'ready_to_launch','live','churned',
];

export default async function PipelinePage() {
  await requireAdmin();
  const supabase = createServiceClient();

  const { data: rows } = await supabase
    .from('crm_business_view')
    .select('*')
    .order('created_at', { ascending: false });

  const businesses = ((rows ?? []) as CrmBizRow[]).sort((a, b) => {
    return STAGE_ORDER.indexOf(a.effective_stage) - STAGE_ORDER.indexOf(b.effective_stage);
  });

  // Dashboard stats
  const total = businesses.length;
  const live = businesses.filter((b) => b.effective_stage === 'live').length;
  const onboarding = businesses.filter((b) =>
    ['onboarding', 'awaiting_content', 'awaiting_offer', 'ready_to_launch'].includes(b.effective_stage)
  ).length;
  const overdueTasks = businesses.reduce((sum, b) => sum + (b.pending_task_count ?? 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Growth CRM</h1>
          <p className="mt-1 text-sm text-gray-500">
            Retailer acquisition pipeline. Statuses auto-derive from platform activity.
          </p>
        </div>
        <Link
          href="/crm/businesses/new"
          className="rounded-lg bg-green-800 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        >
          + Add lead
        </Link>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total businesses', value: total,      color: 'text-gray-900' },
          { label: 'Live retailers',   value: live,       color: 'text-green-700' },
          { label: 'In onboarding',    value: onboarding, color: 'text-amber-700' },
          { label: 'Open tasks',       value: overdueTasks, color: overdueTasks > 0 ? 'text-red-600' : 'text-gray-900' },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <PipelineBoard businesses={businesses} />
    </div>
  );
}
