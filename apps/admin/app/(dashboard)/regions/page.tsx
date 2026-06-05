import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';
import { updateRegion, createRegion, updateRegionDetails } from '@/lib/actions/admin';

export const metadata: Metadata = { title: 'Regions – Admin' };

// ─── Launch readiness constants ───────────────────────────────────────────────

const BUSINESS_TARGET = 100;
const OFFER_TARGET = 250;
const MEMBER_CHECKLIST_TARGET = 1000;

// ─── Launch readiness helpers ─────────────────────────────────────────────────

function computeReadiness(
  activeRetailerCount: number,
  liveOfferCount: number,
  activeMemberCount: number,
  memberThreshold: number,
): number {
  const businessPts = Math.min(25, (activeRetailerCount / BUSINESS_TARGET) * 25);
  const offerPts = Math.min(25, (liveOfferCount / OFFER_TARGET) * 25);
  const memberPts = Math.min(30, (activeMemberCount / Math.max(memberThreshold, 1)) * 30);
  const activityPts = activeRetailerCount > 0 && liveOfferCount > 0 ? 20 : 0;
  return Math.round(businessPts + offerPts + memberPts + activityPts);
}

function readinessLabel(score: number): 'Launch ready' | 'Almost ready' | 'Building' {
  if (score >= 80) return 'Launch ready';
  if (score >= 50) return 'Almost ready';
  return 'Building';
}

function readinessColors(score: number): { bar: string; text: string; badge: string } {
  if (score >= 80) {
    return {
      bar: 'bg-green-500',
      text: 'text-green-600',
      badge: 'bg-green-100 text-green-700 border-green-200',
    };
  }
  if (score >= 50) {
    return {
      bar: 'bg-amber-400',
      text: 'text-amber-600',
      badge: 'bg-amber-100 text-amber-700 border-amber-200',
    };
  }
  return {
    bar: 'bg-blue-400',
    text: 'text-blue-600',
    badge: 'bg-blue-100 text-blue-700 border-blue-200',
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MemberProgressBar({ value, max }: { value: number; max: number }) {
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

function ReadinessProgressBar({ score, barColor }: { score: number; barColor: string }) {
  return (
    <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${barColor}`}
        style={{ width: `${score}%` }}
      />
    </div>
  );
}

function ChecklistItem({
  label,
  current,
  target,
}: {
  label: string;
  current: number;
  target: number;
}) {
  const done = current >= target;
  return (
    <div className="flex items-center gap-1.5 text-xs">
      {done ? (
        <svg
          className="w-3.5 h-3.5 text-green-600 shrink-0"
          fill="none"
          viewBox="0 0 16 16"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l3.5 3.5L13 4.5" />
        </svg>
      ) : (
        <span className="w-3.5 h-3.5 rounded border border-gray-300 shrink-0 inline-block" />
      )}
      <span className={done ? 'text-gray-400 line-through' : 'text-gray-600'}>
        {label}
        <span className="ml-1 tabular-nums text-gray-400">
          ({current.toLocaleString()} / {target.toLocaleString()})
        </span>
      </span>
    </div>
  );
}

function LaunchReadinessSection({
  activeRetailerCount,
  liveOfferCount,
  activeMemberCount,
  memberThreshold,
}: {
  activeRetailerCount: number;
  liveOfferCount: number;
  activeMemberCount: number;
  memberThreshold: number;
}) {
  const score = computeReadiness(
    activeRetailerCount,
    liveOfferCount,
    activeMemberCount,
    memberThreshold,
  );
  const label = readinessLabel(score);
  const colors = readinessColors(score);

  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 mb-4">
      {/* Score + badge row */}
      <div className="flex items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-3">
          <span className={`text-3xl font-bold tabular-nums leading-none ${colors.text}`}>
            {score}%
          </span>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full border ${colors.badge}`}
          >
            {label}
          </span>
        </div>
        <span className="text-xs text-gray-400 shrink-0">Launch readiness</span>
      </div>

      {/* Readiness progress bar */}
      <ReadinessProgressBar score={score} barColor={colors.bar} />

      {/* Checklist */}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        <ChecklistItem
          label="100 businesses"
          current={activeRetailerCount}
          target={BUSINESS_TARGET}
        />
        <ChecklistItem
          label="1,000 members"
          current={activeMemberCount}
          target={MEMBER_CHECKLIST_TARGET}
        />
        <ChecklistItem
          label="250 live offers"
          current={liveOfferCount}
          target={OFFER_TARGET}
        />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

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
            const activeMemberCount: number = r.active_member_count ?? 0;
            const payingMemberCount: number = r.paying_member_count ?? 0;
            const activeRetailerCount: number = r.active_retailer_count ?? 0;
            const liveOfferCount: number = r.live_offer_count ?? 0;
            const atThreshold = activeMemberCount >= r.member_threshold;

            return (
              <div
                key={r.id}
                className={`rounded-lg border bg-white p-5 ${
                  r.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'
                }`}
              >
                {/* ── Header: name + member count ── */}
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
                      {activeMemberCount}
                      <span className="text-sm font-normal text-gray-400">
                        {' '}/ {r.member_threshold}
                      </span>
                    </p>
                    <p className="text-xs text-gray-400">
                      {payingMemberCount} paying · {activeMemberCount} active
                    </p>
                  </div>
                </div>

                {/* ── Launch Readiness Score ── */}
                <LaunchReadinessSection
                  activeRetailerCount={activeRetailerCount}
                  liveOfferCount={liveOfferCount}
                  activeMemberCount={activeMemberCount}
                  memberThreshold={r.member_threshold}
                />

                {/* ── Member threshold progress bar ── */}
                <MemberProgressBar value={activeMemberCount} max={r.member_threshold} />

                {/* ── Stats grid ── */}
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-gray-50 px-3 py-2">
                    <p className="text-xs text-gray-400">Live retailers</p>
                    <p className="font-medium text-gray-800">{activeRetailerCount}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 px-3 py-2">
                    <p className="text-xs text-gray-400">Live offers</p>
                    <p className="font-medium text-gray-800">{liveOfferCount}</p>
                  </div>
                </div>

                {/* ── Edit form ── */}
                <form
                  action={updateRegionDetails}
                  className="mt-4 border-t border-gray-100 pt-4 space-y-3"
                >
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
