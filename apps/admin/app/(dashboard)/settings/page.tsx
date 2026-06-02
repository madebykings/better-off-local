import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';

export const metadata: Metadata = { title: 'Settings – Admin' };

export default async function SettingsPage() {
  await requireAdmin();
  const supabase = createServiceClient();

  const { data: referralConfig } = await supabase
    .from('referral_config')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  const sections = [
    {
      title: 'Stripe',
      items: [
        { label: 'Dashboard', value: 'dashboard.stripe.com', href: 'https://dashboard.stripe.com' },
        { label: 'Webhooks', value: 'View delivery logs and event history', href: 'https://dashboard.stripe.com/webhooks' },
        { label: 'Products & prices', value: 'Manage consumer membership pricing', href: 'https://dashboard.stripe.com/products' },
      ],
    },
    {
      title: 'Supabase',
      items: [
        { label: 'Database', value: 'supabase.com/dashboard', href: 'https://supabase.com/dashboard' },
        { label: 'Auth users', value: 'View and manage auth accounts', href: 'https://supabase.com/dashboard' },
        { label: 'Edge functions', value: 'create-checkout-session, stripe-webhook', href: 'https://supabase.com/dashboard' },
        { label: 'Logs', value: 'View function invocation logs', href: 'https://supabase.com/dashboard' },
      ],
    },
    {
      title: 'Platform configuration',
      items: [
        { label: 'Retailer grace period', value: 'RETAILER_GRACE_DAYS (set via Supabase secrets)', href: null },
        { label: 'Consumer membership plans', value: 'Monthly / Annual — configured via Stripe price IDs', href: null },
        { label: 'Checkout deep link scheme', value: 'APP_SCHEME / APP_UNIVERSAL_LINK_DOMAIN env vars', href: null },
      ],
    },
    {
      title: 'Vercel deployments',
      items: [
        { label: 'Admin portal', value: 'vercel.com/dashboard', href: 'https://vercel.com/dashboard' },
        { label: 'Retailer portal', value: 'vercel.com/dashboard', href: 'https://vercel.com/dashboard' },
      ],
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Platform configuration links and environment references.
        </p>
      </div>

      {/* Referral programme configuration */}
      {referralConfig && (
        <div className="mb-6 bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">Referral programme</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Edit via Supabase — <code className="text-xs bg-gray-50 px-1 rounded">UPDATE referral_config SET ... WHERE id = 1</code>
              </p>
            </div>
          </div>
          <dl className="divide-y divide-gray-100">
            {[
              {
                label: 'Referrer reward',
                value: `${referralConfig.reward_months} free month${referralConfig.reward_months !== 1 ? 's' : ''} per successful referral`,
                description: "Applied to referrer's next billing cycle",
              },
              {
                label: 'Friend reward',
                value: `${referralConfig.friend_reward_months} free month${referralConfig.friend_reward_months !== 1 ? 's' : ''}`,
                description: "Applied to the referred friend's first invoice",
              },
              {
                label: 'Annual plan reward',
                value: `${referralConfig.annual_credit_months} month credit equivalent`,
                description: 'Credited against renewal for annual plan holders',
              },
              {
                label: 'Cap per year',
                value: `${referralConfig.cap_per_year} free months maximum per referrer`,
                description: 'Rewards beyond this are queued for manual review',
              },
              {
                label: 'Grace period',
                value: `${referralConfig.grace_days} days`,
                description: "Reward confirmed this many days after the friend's first payment",
              },
            ].map(({ label, value, description }) => (
              <div key={label} className="px-4 py-3 flex items-start gap-6">
                <dt className="text-sm font-medium text-gray-600 w-52 shrink-0">{label}</dt>
                <dd className="text-sm flex-1">
                  <span className="text-gray-800 font-medium">{value}</span>
                  {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className="space-y-6">
        {sections.map((section) => (
          <div key={section.title} className="bg-white rounded-lg border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">{section.title}</h2>
            </div>
            <dl className="divide-y divide-gray-100">
              {section.items.map((item) => (
                <div key={item.label} className="px-4 py-3 flex items-start gap-6">
                  <dt className="text-sm font-medium text-gray-600 w-52 shrink-0">{item.label}</dt>
                  <dd className="text-sm text-gray-500 flex-1">
                    {item.href ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-700 hover:underline"
                      >
                        {item.value} ↗
                      </a>
                    ) : (
                      <span className="font-mono text-xs bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                        {item.value}
                      </span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}
