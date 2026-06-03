import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';

export const metadata: Metadata = { title: 'Revenue – Admin' };

function fmt(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

function fmtK(n: number) {
  if (n >= 1000) return `£${(n / 100000).toFixed(1)}k`;
  return fmt(n);
}

const MONTHLY_PRICE_PENCE  = 995;   // £9.95/month
const ANNUAL_PRICE_PENCE   = 7900;  // £79/year — update to match Stripe config
const RETAILER_PRICE_PENCE = 9900;  // £99/year per retailer

export default async function RevenuePage() {
  await requireAdmin();
  const supabase = createServiceClient();

  const [
    monthlyActiveResult,
    annualActiveResult,
    trialingResult,
    paidRetailersResult,
    growthRetailersResult,
    trialRetailersResult,
    totalMembersResult,
  ] = await Promise.all([
    supabase
      .from('consumer_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .eq('plan_interval', 'monthly'),
    supabase
      .from('consumer_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .eq('plan_interval', 'annual'),
    supabase
      .from('consumer_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'trialing'),
    supabase
      .from('retailer_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),
    supabase
      .from('retailer_locations')
      .select('id', { count: 'exact', head: true })
      .eq('billing_status', 'free_growth_region'),
    supabase
      .from('retailer_locations')
      .select('id', { count: 'exact', head: true })
      .eq('billing_status', 'paid_required'),
    supabase
      .from('consumer_memberships')
      .select('id', { count: 'exact', head: true })
      .in('status', ['active', 'trialing', 'past_due']),
  ]);

  const monthlyActive = monthlyActiveResult.count ?? 0;
  const annualActive  = annualActiveResult.count ?? 0;
  const trialing      = trialingResult.count ?? 0;
  const paidRetailers = paidRetailersResult.count ?? 0;
  const growthFree    = growthRetailersResult.count ?? 0;
  const paymentReqd   = trialRetailersResult.count ?? 0;
  const totalMembers  = totalMembersResult.count ?? 0;

  // MRR from consumers
  const monthlyMRR  = monthlyActive * MONTHLY_PRICE_PENCE;
  const annualMRR   = Math.round(annualActive * ANNUAL_PRICE_PENCE / 12);
  const totalMRR    = monthlyMRR + annualMRR;
  const totalARR    = totalMRR * 12;

  // Annual retailer revenue (rough — one active sub per retailer)
  const retailerRevenue = paidRetailers * RETAILER_PRICE_PENCE;

  // Platform totals
  const totalRevenue = totalARR + retailerRevenue;

  const metrics = [
    {
      section: 'Consumer memberships',
      rows: [
        { label: 'Active monthly members', value: monthlyActive, note: null },
        { label: 'Active annual members',  value: annualActive,  note: null },
        { label: 'Trialing',               value: trialing,      note: null },
        { label: 'Total active + trialing', value: totalMembers, note: null },
      ],
    },
    {
      section: 'Consumer revenue (estimated)',
      rows: [
        { label: 'MRR — monthly plans', value: fmt(monthlyMRR),  note: null },
        { label: 'MRR — annual plans',  value: fmt(annualMRR),   note: '÷12 of annual price' },
        { label: 'Total MRR',           value: fmt(totalMRR),    note: null },
        { label: 'ARR',                 value: fmtK(totalARR),   note: 'MRR × 12' },
      ],
    },
    {
      section: 'Retailer accounts',
      rows: [
        { label: 'Active paid subscriptions',    value: paidRetailers, note: null },
        { label: 'Growth-region free venues',    value: growthFree,    note: 'Region below threshold' },
        { label: 'Payment required (unpaid)',     value: paymentReqd,   note: 'Threshold met, not yet paid' },
      ],
    },
    {
      section: 'Retailer revenue (estimated)',
      rows: [
        { label: 'Annual retailer revenue',      value: fmt(retailerRevenue), note: `${paidRetailers} × £${RETAILER_PRICE_PENCE/100}/yr` },
      ],
    },
    {
      section: 'Platform total (estimated)',
      rows: [
        { label: 'Combined projected annual revenue', value: fmtK(totalRevenue), note: 'Consumer ARR + retailer annual' },
      ],
    },
  ];

  const payingMembers = monthlyActive + annualActive;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Revenue</h1>
        <p className="mt-1 text-sm text-gray-500">
          Estimated figures based on plan counts and configured prices. Verify exact amounts in Stripe.
        </p>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">MRR</p>
          <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">{fmt(totalMRR)}</p>
          <p className="text-xs text-gray-400 mt-1">Monthly recurring revenue</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">ARR</p>
          <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">{fmtK(totalARR)}</p>
          <p className="text-xs text-gray-400 mt-1">MRR × 12</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Paying members</p>
          <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">{payingMembers}</p>
          <p className="text-xs text-gray-400 mt-1">{monthlyActive} monthly · {annualActive} annual</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Paying retailers</p>
          <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">{paidRetailers}</p>
          <p className="text-xs text-gray-400 mt-1">Active subscriptions</p>
        </div>
      </div>

      <div className="space-y-4">
        {metrics.map((section) => (
          <div key={section.section} className="bg-white rounded-lg border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">{section.section}</h2>
            </div>
            <dl className="divide-y divide-gray-100">
              {section.rows.map((row) => (
                <div key={row.label} className="px-4 py-3 flex items-center gap-6">
                  <dt className="text-sm text-gray-600 flex-1">{row.label}</dt>
                  <dd className="text-sm font-semibold text-gray-900 tabular-nums shrink-0">{row.value}</dd>
                  {row.note && (
                    <span className="text-xs text-gray-400 shrink-0">{row.note}</span>
                  )}
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
        Prices are configured in this file ({`apps/admin/app/(dashboard)/revenue/page.tsx`}).
        Update <code className="font-mono text-xs">MONTHLY_PRICE_PENCE</code>, <code className="font-mono text-xs">ANNUAL_PRICE_PENCE</code>, and <code className="font-mono text-xs">RETAILER_PRICE_PENCE</code> to match your Stripe products.
        For live revenue data, see <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer" className="underline">Stripe dashboard</a>.
      </div>
    </div>
  );
}
