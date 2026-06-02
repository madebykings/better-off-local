import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';
import { updatePlatformConfig } from '@/lib/actions/admin';

export const metadata: Metadata = { title: 'Content – Admin' };

export default async function ContentPage() {
  await requireAdmin();
  const supabase = createServiceClient();

  const { data: config } = await supabase
    .from('platform_config')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  const updatedAt = config?.updated_at
    ? new Date(config.updated_at).toLocaleString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Homepage content</h1>
        <p className="mt-1 text-sm text-gray-500">
          Edit the headline, body text, and CTA for the app homepage. Changes take effect immediately — no deployment required.
          {updatedAt && <span className="ml-1 text-gray-400">Last updated {updatedAt}.</span>}
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 max-w-2xl">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">App homepage</h2>
        </div>
        <form action={updatePlatformConfig} className="p-4 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Headline
            </label>
            <input
              type="text"
              name="homepage_headline"
              defaultValue={config?.homepage_headline ?? ''}
              maxLength={120}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-700/20 focus:border-green-700"
            />
            <p className="mt-1 text-xs text-gray-400">Displayed as the main heading on the app home screen.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Supporting copy
            </label>
            <textarea
              name="homepage_body"
              defaultValue={config?.homepage_body ?? ''}
              maxLength={300}
              rows={3}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-700/20 focus:border-green-700 resize-none"
            />
            <p className="mt-1 text-xs text-gray-400">Shown below the headline. Keep to 1-2 sentences.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                CTA button text
              </label>
              <input
                type="text"
                name="homepage_cta_text"
                defaultValue={config?.homepage_cta_text ?? ''}
                maxLength={40}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-700/20 focus:border-green-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                CTA destination URL
              </label>
              <input
                type="url"
                name="homepage_cta_url"
                defaultValue={config?.homepage_cta_url ?? ''}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-700/20 focus:border-green-700"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 border-t border-gray-100 pt-4">
            <button
              type="submit"
              className="rounded-lg bg-green-800 px-5 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            >
              Save changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
