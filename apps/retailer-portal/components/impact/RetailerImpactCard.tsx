import { createServiceClient } from '@/lib/supabase/service';
import { MetricCard } from '@better-off-local/ui';

// ── Types ─────────────────────────────────────────────────────────────────────

type RetailerImpactRow = {
  member_savings_pence: number | null;
  total_redemptions: number | null;
  unique_members_served: number | null;
  loyalty_completions: number | null;
  referrals_generated: number | null;
  followers: number | null;
  event_attendance: number | null;
  monthly_redemptions: MonthlyRedemption[] | null;
};

type MonthlyRedemption = {
  month: string;
  count: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPence(pence: number | null): string {
  if (pence == null || pence === 0) return '£0';
  const pounds = pence / 100;
  return `£${pounds % 1 === 0 ? pounds.toFixed(0) : pounds.toFixed(2)}`;
}

function num(value: number | null): string {
  return value != null ? value.toString() : '0';
}

// Month-over-month trend: returns the last two non-null months and calculates
// a percentage change. Returns null if insufficient data.
function calcMonthlyTrend(
  monthly: MonthlyRedemption[] | null,
): { current: number; previous: number; pct: number } | null {
  if (!monthly || monthly.length < 2) return null;
  // Assume sorted ascending by month
  const last = monthly[monthly.length - 1];
  const prev = monthly[monthly.length - 2];
  if (!prev.count) return null;
  const pct = Math.round(((last.count - prev.count) / prev.count) * 100);
  return { current: last.count, previous: prev.count, pct };
}

// ── Component ─────────────────────────────────────────────────────────────────

interface RetailerImpactCardProps {
  retailerId: string;
}

export async function RetailerImpactCard({ retailerId }: RetailerImpactCardProps) {
  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc('get_retailer_impact', {
    p_retailer_id: retailerId,
  });

  // RPC returns a set; grab the first row (or default to zeroes)
  const row: RetailerImpactRow =
    !error && Array.isArray(data) && data.length > 0
      ? (data[0] as RetailerImpactRow)
      : {
          member_savings_pence: 0,
          total_redemptions: 0,
          unique_members_served: 0,
          loyalty_completions: 0,
          referrals_generated: 0,
          followers: 0,
          event_attendance: 0,
          monthly_redemptions: null,
        };

  const trend = calcMonthlyTrend(row.monthly_redemptions);

  const metrics = [
    { label: 'Member savings generated', value: formatPence(row.member_savings_pence) },
    { label: 'Total redemptions', value: num(row.total_redemptions) },
    { label: 'Unique members served', value: num(row.unique_members_served) },
    { label: 'Loyalty completions', value: num(row.loyalty_completions) },
    { label: 'Referrals generated', value: num(row.referrals_generated) },
    { label: 'Followers', value: num(row.followers) },
    { label: 'Event attendance', value: num(row.event_attendance) },
  ] as const;

  const monthly = row.monthly_redemptions ?? [];

  return (
    <div>
      {/* Metric grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 mb-6">
        {metrics.map((m) => (
          <MetricCard key={m.label} label={m.label} value={m.value} />
        ))}
      </div>

      {/* Month-over-month callout */}
      {trend !== null && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 flex items-center gap-3">
          <span
            className={`text-sm font-semibold ${
              trend.pct >= 0 ? 'text-green-700' : 'text-red-600'
            }`}
          >
            {trend.pct >= 0 ? `+${trend.pct}%` : `${trend.pct}%`}
          </span>
          <span className="text-sm text-gray-600">
            redemptions vs previous month ({trend.previous} → {trend.current})
          </span>
        </div>
      )}

      {/* Monthly trend bar chart */}
      {monthly.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-600 mb-3">
            Monthly redemptions (last {monthly.length} months)
          </h3>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <MonthlyBarChart data={monthly} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Monthly bar chart (pure CSS, no external library) ─────────────────────────

function MonthlyBarChart({ data }: { data: MonthlyRedemption[] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="flex items-end gap-1 h-20">
      {data.map((d) => {
        const heightPct = Math.max((d.count / maxCount) * 100, 4);
        // Shorten month label to 3 chars
        const label = d.month.length > 3 ? d.month.slice(0, 3) : d.month;
        return (
          <div key={d.month} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-sm bg-green-700 opacity-70"
              style={{ height: `${heightPct}%` }}
              title={`${d.month}: ${d.count}`}
            />
            <span className="text-[9px] text-gray-400 leading-none truncate w-full text-center">
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
