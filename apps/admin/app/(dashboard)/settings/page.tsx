import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/require_admin';

export const metadata: Metadata = { title: 'Settings – Admin' };

export default async function SettingsPage() {
  await requireAdmin();

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

      <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
        Platform settings UI (grace periods, plan configuration, notification templates) is planned for a future release.
        For now, manage these via Supabase secrets and Stripe dashboard directly.
      </div>
    </div>
  );
}
