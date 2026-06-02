import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';
import { createBusiness } from '@/lib/actions/crm';

export const metadata: Metadata = { title: 'Add Lead – Growth CRM' };

export default async function NewBusinessPage() {
  await requireAdmin();
  const supabase = createServiceClient();

  const [{ data: regions }, { data: admins }] = await Promise.all([
    supabase.from('regions').select('id, name').eq('is_active', true).order('name'),
    supabase.from('profiles').select('id, full_name').order('full_name'),
  ]);

  const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-700/20 focus:border-green-700';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5';

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <Link href="/crm/pipeline" className="hover:text-gray-600">Pipeline</Link>
        <span>›</span>
        <span className="text-gray-700">Add lead</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Add a business lead</h1>
        <p className="mt-1 text-sm text-gray-500">
          Create a CRM record for a prospect. This is separate from their retailer account until they sign up.
        </p>
      </div>

      <form action={createBusiness} className="max-w-xl space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Business name *</label>
            <input name="name" required type="text" placeholder="e.g. The Coffee Spot" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Contact name</label>
            <input name="contact_name" type="text" placeholder="e.g. Sarah Jones" className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Email</label>
            <input name="email" type="email" placeholder="sarah@example.com" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Phone</label>
            <input name="phone" type="tel" placeholder="01259 123456" className={inputCls} />
          </div>
        </div>

        <div>
          <label className={labelCls}>Website</label>
          <input name="website" type="url" placeholder="https://thecoffeespot.co.uk" className={inputCls} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Region</label>
            <select name="region_id" className={inputCls}>
              <option value="">Select region…</option>
              {(regions ?? []).map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Category</label>
            <input name="category" type="text" placeholder="e.g. Food & Drink" className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Stage</label>
            <select name="stage" className={inputCls}>
              <option value="lead">Lead</option>
              <option value="contacted">Contacted</option>
              <option value="interested">Interested</option>
              <option value="meeting_booked">Meeting Booked</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Assigned to</label>
            <select name="assigned_to" className={inputCls}>
              <option value="">Unassigned</option>
              {(admins ?? []).map((a) => (
                <option key={a.id} value={a.id}>{a.full_name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls}>Follow-up date</label>
          <input name="next_followup_at" type="date" className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>Notes</label>
          <textarea
            name="notes"
            rows={4}
            placeholder="Initial notes about this business…"
            className={inputCls + ' resize-none'}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="rounded-lg bg-green-800 px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            Add to pipeline
          </button>
          <Link
            href="/crm/pipeline"
            className="rounded-lg border border-gray-200 px-6 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
