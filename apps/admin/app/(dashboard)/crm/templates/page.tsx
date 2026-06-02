import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';
import { createEmailTemplate, deleteEmailTemplate } from '@/lib/actions/crm';

export const metadata: Metadata = { title: 'Email Templates – Growth CRM' };

const VARS_HINT = '{{business_name}} {{contact_name}} {{region_name}} {{sender_name}} {{signup_link}} {{meeting_date}}';

const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-700';

export default async function TemplatesPage() {
  await requireAdmin();
  const supabase = createServiceClient();
  const { data: templates } = await supabase
    .from('crm_email_templates')
    .select('*')
    .order('name');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Email templates</h1>
        <p className="mt-1 text-sm text-gray-500">
          Reusable templates for outreach, follow-ups, and onboarding.
          Variables: <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{VARS_HINT}</code>
        </p>
      </div>

      {/* Add template */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Add template</h2>
        <form action={createEmailTemplate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Template name *</label>
              <input name="name" required type="text" placeholder="e.g. Initial Outreach" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Subject line *</label>
              <input name="subject" required type="text" placeholder="e.g. Better Off Local — free listing" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Body HTML *</label>
            <textarea
              name="body_html"
              required
              rows={8}
              placeholder="<p>Hi {{contact_name}},</p><p>...</p>"
              className={inputCls + ' font-mono resize-y'}
            />
          </div>
          <button type="submit" className="rounded-lg bg-green-800 px-5 py-2 text-sm font-semibold text-white hover:opacity-90">
            Save template
          </button>
        </form>
      </div>

      {/* Template list */}
      <div className="space-y-3">
        {(templates ?? []).map((t: any) => (
          <div key={t.id} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">{t.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{t.subject}</p>
              </div>
              <form action={deleteEmailTemplate}>
                <input type="hidden" name="id" value={t.id} />
                <button
                  type="submit"
                  onClick={(e) => { if (!confirm('Delete this template?')) e.preventDefault(); }}
                  className="text-xs text-gray-300 hover:text-red-500 transition-colors ml-4"
                >
                  Delete
                </button>
              </form>
            </div>
            <details className="mt-2">
              <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">Preview body</summary>
              <div
                className="mt-2 text-xs text-gray-600 border border-gray-100 rounded p-3 bg-gray-50 overflow-auto max-h-40"
                dangerouslySetInnerHTML={{ __html: t.body_html }}
              />
            </details>
          </div>
        ))}
        {!templates?.length && (
          <div className="text-center py-12 border border-gray-200 rounded-lg text-gray-400 text-sm">
            No templates yet. Add one above or check the seeded templates in the database.
          </div>
        )}
      </div>
    </div>
  );
}
