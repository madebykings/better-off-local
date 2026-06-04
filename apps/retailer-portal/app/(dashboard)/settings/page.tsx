import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Settings – Retailer Portal' };

export default async function SettingsPage() {
  return (
    <div className="max-w-2xl space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Business preferences and integrations.</p>
      </div>

      {/* ── Notifications ─────────────────────────────────────────────────── */}
      <section>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-gray-900">Notifications</h2>
          <p className="text-sm text-gray-500 mt-1">Choose when you receive emails and alerts.</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
          {[
            { label: 'New redemptions', description: 'Email when a member redeems one of your offers.', defaultOn: true },
            { label: 'New reviews', description: 'Email when a member leaves a review.', defaultOn: true },
            { label: 'Offer approved', description: 'Email when an admin approves a submitted offer.', defaultOn: true },
            { label: 'Monthly summary', description: 'Monthly digest of redemptions and member activity.', defaultOn: false },
          ].map((pref) => (
            <div key={pref.label} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-800">{pref.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{pref.description}</p>
              </div>
              <span className="text-xs text-gray-400 italic">Coming soon</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Integrations ──────────────────────────────────────────────────── */}
      <section>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-gray-900">Integrations</h2>
          <p className="text-sm text-gray-500 mt-1">Connect your business tools.</p>
        </div>
        <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
          Integrations coming soon — point-of-sale systems, booking platforms, and more.
        </div>
      </section>
    </div>
  );
}
