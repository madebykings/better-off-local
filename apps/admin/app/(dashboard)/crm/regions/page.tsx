import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';

export const metadata: Metadata = { title: 'Regional Growth – Growth CRM' };

const STAGE_ORDER = ['lead','contacted','interested','meeting_booked',
  'onboarding','awaiting_content','awaiting_offer','ready_to_launch','live','churned'];

function ProgressBar({ value, max, color = 'bg-green-600' }: { value: number; max: number; color?: string }) {
  const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 tabular-nums shrink-0">{pct}%</span>
    </div>
  );
}

export default async function CrmRegionsPage() {
  await requireAdmin();
  const supabase = createServiceClient();

  const [{ data: regionStats }, { data: businesses }] = await Promise.all([
    supabase.from('region_public_stats').select('*').order('name'),
    supabase
      .from('crm_business_view')
      .select('region_id, region_name, effective_stage, retailer_id'),
  ]);

  const regions = regionStats ?? [];
  const allBiz = businesses ?? [];

  // Group CRM businesses by region.
  const bizByRegion: Record<string, typeof allBiz> = {};
  for (const b of allBiz) {
    const key = b.region_id ?? '__none__';
    if (!bizByRegion[key]) bizByRegion[key] = [];
    bizByRegion[key].push(b);
  }

  const fmt = (n: number) => n.toLocaleString('en-GB');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Regional growth</h1>
        <p className="mt-1 text-sm text-gray-500">
          Retailer acquisition progress and consumer metrics per region.
        </p>
      </div>

      <div className="space-y-6">
        {regions.map((r: any) => {
          const bizInRegion = bizByRegion[r.id] ?? [];
          const stageCounts: Record<string, number> = {};
          for (const b of bizInRegion) {
            stageCounts[b.effective_stage] = (stageCounts[b.effective_stage] ?? 0) + 1;
          }

          const liveRetailers = stageCounts['live'] ?? 0;
          const onboardingRetailers = (stageCounts['onboarding'] ?? 0)
            + (stageCounts['awaiting_content'] ?? 0)
            + (stageCounts['awaiting_offer'] ?? 0)
            + (stageCounts['ready_to_launch'] ?? 0);

          const memberPct = Math.round((r.paying_member_count / Math.max(r.member_threshold, 1)) * 100);
          const billingActive = r.paying_member_count >= r.member_threshold;

          return (
            <div key={r.id} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              {/* Region header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{r.name}</h2>
                  <p className="text-xs text-gray-400">{r.country}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${billingActive ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                  {billingActive ? '⚡ Billing active' : '🌱 Growth phase'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-gray-100">
                {/* Consumer metrics */}
                <div className="p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Members</p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Active</span>
                      <span className="font-semibold">{fmt(r.paying_member_count)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Target</span>
                      <span className="font-semibold">{fmt(r.member_threshold)}</span>
                    </div>
                    <div className="mt-2">
                      <ProgressBar value={r.paying_member_count} max={r.member_threshold} color={billingActive ? 'bg-green-500' : 'bg-blue-500'} />
                    </div>
                  </div>
                </div>

                {/* Retailer metrics */}
                <div className="p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Retailers</p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Live</span>
                      <span className="font-semibold text-green-700">{liveRetailers}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Onboarding</span>
                      <span className="font-semibold text-amber-700">{onboardingRetailers}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Live offers</span>
                      <span className="font-semibold">{r.live_offer_count ?? 0}</span>
                    </div>
                  </div>
                </div>

                {/* Pipeline breakdown */}
                <div className="p-4 sm:col-span-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Acquisition pipeline</p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                    {[
                      { id: 'lead',            label: 'Leads' },
                      { id: 'contacted',       label: 'Contacted' },
                      { id: 'interested',      label: 'Interested' },
                      { id: 'meeting_booked',  label: 'Meeting Booked' },
                    ].map((s) => (
                      <div key={s.id} className="flex justify-between text-sm">
                        <span className="text-gray-500">{s.label}</span>
                        <span className="font-semibold">{stageCounts[s.id] ?? 0}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-sm">
                    <span className="text-gray-500">Total in CRM</span>
                    <span className="font-semibold">{bizInRegion.length}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {regions.length === 0 && (
          <div className="text-center py-16 border border-gray-200 rounded-lg text-gray-400 text-sm">
            No active regions. Add regions in the Regions module.
          </div>
        )}
      </div>
    </div>
  );
}
