import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';
import { updateRegion, createRegion, updateRegionDetails } from '@/lib/actions/admin';

export const metadata: Metadata = { title: 'Regions – Admin' };

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
  const cls = pct >= 100 ? 'bg-green-600' : pct >= 60 ? 'bg-amber-500' : 'bg-blue-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${cls}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-gray-500 shrink-0">{pct}%</span>
    </div>
  );
}

export default async function RegionsPage() {
  await requireAdmin();
  const supabase = createServiceClient();

  const { data: stats } = await supabase
    .from('region_public_stats')
    .select('*')
    .order('name');

  const regions = stats ?? [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Regions</h1>
        <p className="mt-1 text-sm text-gray-500">
          Member count thresholds control when retailer billing activates per region.
          Threshold uses active + trialing members.
        </p>
      </div>

      {/* Create region */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Create region</h2>
        <form action={createRegion} className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Name *</label>
            <input
              name="name"
              type="text"
              placeholder="e.g. Clackmannanshire"
              required
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-700 w-52"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Description</label>
            <input
              name="description"
              type="text"
              placeholder="Public description for members"
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-700 w-64"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Member threshold</label>
            <input
              name="member_threshold"
              type="number"
              defaultValue={500}
              min={1}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-700 w-28"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-green-800 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            Create
          </button>
        </form>
      </div>

      {regions.length === 0 ? (
        <p className="text-sm text-gray-400">No regions found. Run migration 055.</p>
      ) : (
        <div className="space-y-4">
          {regions.map((r: any) => {
            const atThreshold = (r.active_member_count ?? 0) >= r.member_threshold;
            return (
              <div
                key={r.id}
                className={`rounded-lg border bg-white p-5 ${
                  r.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold text-gray-900">{r.name}</h2>
                      {!r.is_active && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200">
                          Inactive
                        </span>
                      )}
                      {atThreshold && r.is_active && (
                        <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded border border-green-200 font-medium">
                          Threshold met
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{r.slug}</p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-2xl font-bold text-gray-900 tabular-nums">
                      {r.active_member_count ?? 0}
                      <span className="text-sm font-normal text-gray-400"> / {r.member_threshold}</span>
                    </p>
                    <p className="text-xs text-gray-400">
                      {r.paying_member_count ?? 0} paying · {r.active_member_count ?? 0} active
                    </p>
                  </div>
                </div>

                <ProgressBar value={r.active_member_count ?? 0} max={r.member_threshold} />

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-gray-50 px-3 py-2">
                    <p className="text-xs text-gray-400">Live retailers</p>
                    <p className="font-medium text-gray-800">{r.active_retailer_count ?? 0}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 px-3 py-2">
                    <p className="text-xs text-gray-400">Live offers</p>
                    <p className="font-medium text-gray-800">{r.live_offer_count ?? 0}</p>
                  </div>
                </div>

                <form action={updateRegionDetails} className="mt-4 border-t border-gray-100 pt-4 space-y-3">
                  <input type="hidden" name="region_id" value={r.id} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Name</label>
                      <input
                        type="text"
                        name="name"
                        defaultValue={r.name}
                        className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm
                                   focus:outline-none focus:ring-1 focus:ring-green-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Description</label>
                      <input
                        type="text"
                        name="description"
                        defaultValue={r.description ?? ''}
                        placeholder="Public description for members"
                        className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm
                                   focus:outline-none focus:ring-1 focus:ring-green-700"
                      />
                    </div>
                  </div>
                  <div className="flex items-end gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Threshold</label>
                      <input
                        type="number"
                        name="member_threshold"
                        defaultValue={r.member_threshold}
                        min={1}
                        className="w-24 rounded-lg border border-gray-200 px-3 py-1.5 text-sm
                                   focus:outline-none focus:ring-1 focus:ring-green-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Active</label>
                      <select
                        name="is_active"
                        defaultValue={String(r.is_active)}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm
                                   focus:outline-none focus:ring-1 focus:ring-green-700"
                      >
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    </div>
                    <button
                      type="submit"
                      className="rounded-lg bg-gray-800 px-4 py-1.5 text-sm font-medium text-white
                                 hover:bg-gray-700 transition-colors"
                    >
                      Save
                    </button>
                  </div>
                </form>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
