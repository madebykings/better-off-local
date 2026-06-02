import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';
import {
  updateBusiness, updateBusinessStage, createMeeting, updateMeetingOutcome,
  createTask, completeTask, linkRetailer, deleteBusiness,
} from '@/lib/actions/crm';
import { EmailComposer } from '@/components/crm/email_composer';

export const metadata: Metadata = { title: 'Business – Growth CRM' };

interface Props { params: Promise<{ id: string }> }

const STAGE_OPTIONS = [
  { value: 'lead',            label: 'Lead' },
  { value: 'contacted',       label: 'Contacted' },
  { value: 'interested',      label: 'Interested' },
  { value: 'meeting_booked',  label: 'Meeting Booked' },
];

const MEETING_OUTCOMES = [
  { value: 'interested',      label: 'Interested' },
  { value: 'follow_up_later', label: 'Follow Up Later' },
  { value: 'not_interested',  label: 'Not Interested' },
  { value: 'ready_to_join',   label: 'Ready To Join' },
  { value: 'no_response',     label: 'No Response' },
];

const STAGE_BADGE: Record<string, string> = {
  lead:             'bg-gray-100 text-gray-600',
  contacted:        'bg-blue-100 text-blue-700',
  interested:       'bg-purple-100 text-purple-700',
  meeting_booked:   'bg-amber-100 text-amber-700',
  onboarding:       'bg-orange-100 text-orange-700',
  awaiting_content: 'bg-yellow-100 text-yellow-700',
  awaiting_offer:   'bg-cyan-100 text-cyan-700',
  ready_to_launch:  'bg-teal-100 text-teal-700',
  live:             'bg-green-100 text-green-700',
  churned:          'bg-red-100 text-red-700',
};

const STAGE_LABEL: Record<string, string> = {
  lead:'Lead', contacted:'Contacted', interested:'Interested',
  meeting_booked:'Meeting Booked', onboarding:'Onboarding',
  awaiting_content:'Awaiting Content', awaiting_offer:'Awaiting Offer',
  ready_to_launch:'Ready To Launch', live:'Live', churned:'Churned',
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-700';

const CHECKLIST_LABELS = [
  'Business name set',
  'Short description added',
  'Logo uploaded',
  'Cover image uploaded',
  'Location added',
  'Offer created',
  'Subscription active',
];

export default async function BusinessDetailPage({ params }: Props) {
  const { id } = await params;
  await requireAdmin();
  const supabase = createServiceClient();

  const [
    { data: biz },
    { data: meetings },
    { data: tasks },
    { data: emails },
    { data: activity },
    { data: regions },
    { data: admins },
    { data: templates },
    { data: retailers },
  ] = await Promise.all([
    supabase.from('crm_business_view').select('*').eq('id', id).single(),
    supabase.from('crm_meetings').select('*').eq('business_id', id).order('scheduled_at', { ascending: false }),
    supabase.from('crm_tasks').select('*, profiles(full_name)').eq('business_id', id).order('due_at', { ascending: true }),
    supabase.from('crm_emails').select('*').eq('business_id', id).order('sent_at', { ascending: false }),
    supabase.from('crm_activity_log').select('*, profiles(full_name)').eq('business_id', id).order('created_at', { ascending: false }).limit(50),
    supabase.from('regions').select('id, name').eq('is_active', true).order('name'),
    supabase.from('profiles').select('id, full_name').order('full_name'),
    supabase.from('crm_email_templates').select('id, name, subject, body_html').order('name'),
    supabase.from('retailers').select('id, name').eq('is_active', true).order('name').limit(200),
  ]);

  if (!biz) notFound();

  const effectiveStage: string = (biz as any).effective_stage ?? 'lead';
  const onboardingScore: number = (biz as any).onboarding_score ?? 0;
  const onboardingPct = Math.round((onboardingScore / 7) * 100);

  // Onboarding checklist bits (derive from score — biz.retailer_id determines if it applies)
  const signupLink = `https://retailer.betterofflocal.com/sign-up`;

  return (
    <div className="max-w-5xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <Link href="/crm/pipeline" className="hover:text-gray-600">Pipeline</Link>
        <span>›</span>
        <span className="text-gray-700 truncate max-w-xs">{(biz as any).name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold">{(biz as any).name}</h1>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${STAGE_BADGE[effectiveStage] ?? ''}`}>
              {STAGE_LABEL[effectiveStage] ?? effectiveStage}
              {(biz as any).retailer_id && effectiveStage !== (biz as any).manual_stage && (
                <span className="ml-1 opacity-60">(auto)</span>
              )}
            </span>
          </div>
          {(biz as any).contact_name && (
            <p className="text-sm text-gray-500 mt-1">{(biz as any).contact_name}</p>
          )}
        </div>
        <form action={deleteBusiness}>
          <input type="hidden" name="id" value={id} />
          <button
            type="submit"
            onClick={(e) => { if (!confirm('Delete this business from the CRM?')) e.preventDefault(); }}
            className="text-xs text-red-500 hover:text-red-700 underline"
          >
            Delete
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: details + onboarding */}
        <div className="lg:col-span-1 space-y-4">

          {/* Edit details */}
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Business details</h2>
            <form action={updateBusiness} className="space-y-3">
              <input type="hidden" name="id" value={id} />
              <div>
                <label className="block text-xs text-gray-500 mb-1">Business name</label>
                <input name="name" defaultValue={(biz as any).name} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Contact name</label>
                <input name="contact_name" defaultValue={(biz as any).contact_name ?? ''} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Email</label>
                <input name="email" type="email" defaultValue={(biz as any).email ?? ''} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Phone</label>
                <input name="phone" type="tel" defaultValue={(biz as any).phone ?? ''} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Website</label>
                <input name="website" type="url" defaultValue={(biz as any).website ?? ''} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Region</label>
                <select name="region_id" defaultValue={(biz as any).region_id ?? ''} className={inputCls}>
                  <option value="">No region</option>
                  {(regions ?? []).map((r: any) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Category</label>
                <input name="category" defaultValue={(biz as any).category ?? ''} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Assigned to</label>
                <select name="assigned_to" defaultValue={(biz as any).assigned_to ?? ''} className={inputCls}>
                  <option value="">Unassigned</option>
                  {(admins ?? []).map((a: any) => (
                    <option key={a.id} value={a.id}>{a.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Follow-up date</label>
                <input
                  name="next_followup_at"
                  type="date"
                  defaultValue={(biz as any).next_followup_at ? new Date((biz as any).next_followup_at).toISOString().slice(0, 10) : ''}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Notes</label>
                <textarea name="notes" rows={3} defaultValue={(biz as any).notes ?? ''} className={inputCls + ' resize-none'} />
              </div>
              <button type="submit" className="w-full rounded-lg bg-green-800 px-3 py-2 text-sm font-semibold text-white hover:opacity-90">
                Save details
              </button>
            </form>
          </section>

          {/* Manual stage override (for pure prospects without retailer account) */}
          {!(biz as any).retailer_id && (
            <section className="rounded-lg border border-gray-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Pipeline stage</h2>
              <form action={updateBusinessStage} className="flex gap-2">
                <input type="hidden" name="id" value={id} />
                <select name="stage" defaultValue={(biz as any).manual_stage} className={inputCls}>
                  {STAGE_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <button type="submit" className="shrink-0 rounded-lg border border-green-700 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50">
                  Update
                </button>
              </form>
              <p className="mt-1.5 text-xs text-gray-400">
                Stage auto-derives from platform data once a retailer account is linked.
              </p>
            </section>
          )}

          {/* Link to retailer account */}
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Retailer account</h2>
            {(biz as any).retailer_id ? (
              <div>
                <Link
                  href={`/retailers/${(biz as any).retailer_id}`}
                  className="text-sm text-green-700 hover:underline font-medium"
                >
                  View retailer profile →
                </Link>
                <form action={linkRetailer} className="mt-3">
                  <input type="hidden" name="business_id" value={id} />
                  <input type="hidden" name="retailer_id" value="" />
                  <button type="submit" className="text-xs text-gray-400 hover:text-gray-600 underline">
                    Unlink account
                  </button>
                </form>
              </div>
            ) : (
              <form action={linkRetailer} className="flex gap-2">
                <input type="hidden" name="business_id" value={id} />
                <select name="retailer_id" className={inputCls}>
                  <option value="">Select retailer…</option>
                  {(retailers ?? []).map((r: any) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                <button type="submit" className="shrink-0 rounded-lg border border-green-700 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50">
                  Link
                </button>
              </form>
            )}
          </section>

          {/* Onboarding progress (when linked) */}
          {(biz as any).retailer_id && (
            <section className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-gray-700">Onboarding progress</h2>
                <span className={`text-sm font-bold ${onboardingPct >= 100 ? 'text-green-700' : 'text-amber-600'}`}>
                  {onboardingPct}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full transition-all ${onboardingPct >= 100 ? 'bg-green-500' : 'bg-amber-400'}`}
                  style={{ width: `${onboardingPct}%` }}
                />
              </div>
              <ul className="space-y-1">
                {CHECKLIST_LABELS.map((label, i) => (
                  <li key={label} className={`flex items-center gap-2 text-xs ${i < onboardingScore ? 'text-gray-700' : 'text-gray-400'}`}>
                    <span>{i < onboardingScore ? '✓' : '○'}</span>
                    {label}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Right column: email, meetings, tasks, timeline */}
        <div className="lg:col-span-2 space-y-6">

          {/* Email */}
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Send email</h2>
            {(biz as any).email ? (
              <EmailComposer
                businessId={id}
                defaultTo={(biz as any).email}
                templates={(templates ?? []) as any}
                senderName="Better Off Local Team"
                businessName={(biz as any).name}
                regionName={(biz as any).region_name ?? 'Clackmannanshire'}
                signupLink={signupLink}
              />
            ) : (
              <p className="text-sm text-gray-400">No email address on record. Add one in the details panel.</p>
            )}
          </section>

          {/* Email history */}
          {emails && emails.length > 0 && (
            <section className="rounded-lg border border-gray-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Email history</h2>
              <div className="space-y-2">
                {emails.map((e: any) => (
                  <div key={e.id} className="rounded-lg border border-gray-100 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-gray-800">{e.subject}</p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          e.delivery_status === 'delivered' ? 'bg-green-100 text-green-700' :
                          e.delivery_status === 'failed' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {e.delivery_status}
                        </span>
                        {e.opened_at && <span className="text-[10px] text-gray-400">👁 opened</span>}
                        {e.clicked_at && <span className="text-[10px] text-gray-400">🖱 clicked</span>}
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{fmtTime(e.sent_at)} → {e.sent_to}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Meetings */}
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Meetings</h2>

            <form action={createMeeting} className="flex items-end gap-3 mb-4 flex-wrap">
              <input type="hidden" name="business_id" value={id} />
              <div>
                <label className="block text-xs text-gray-500 mb-1">Date & time</label>
                <input name="scheduled_at" type="datetime-local" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Notes</label>
                <input name="notes" type="text" placeholder="Pre-meeting notes…" className={inputCls + ' w-52'} />
              </div>
              <button type="submit" className="shrink-0 rounded-lg bg-green-800 px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
                Log meeting
              </button>
            </form>

            <div className="space-y-3">
              {(meetings ?? []).map((m: any) => (
                <div key={m.id} className="rounded-lg border border-gray-100 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-800">{fmtTime(m.scheduled_at)}</p>
                    {m.outcome && (
                      <span className="text-xs text-gray-500 capitalize">{m.outcome.replace(/_/g, ' ')}</span>
                    )}
                  </div>
                  {m.notes && <p className="text-xs text-gray-500 mt-1">{m.notes}</p>}

                  {!m.outcome && (
                    <form action={updateMeetingOutcome} className="flex items-center gap-2 mt-2">
                      <input type="hidden" name="meeting_id" value={m.id} />
                      <input type="hidden" name="business_id" value={id} />
                      <select name="outcome" className="text-xs border border-gray-200 rounded px-2 py-1">
                        <option value="">Record outcome…</option>
                        {MEETING_OUTCOMES.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <input name="notes" type="text" placeholder="Outcome notes" className="text-xs border border-gray-200 rounded px-2 py-1 flex-1" />
                      <input name="follow_up_date" type="date" className="text-xs border border-gray-200 rounded px-2 py-1" />
                      <button type="submit" className="text-xs bg-green-800 text-white px-2 py-1 rounded hover:opacity-90">
                        Save
                      </button>
                    </form>
                  )}
                </div>
              ))}
              {!meetings?.length && (
                <p className="text-sm text-gray-400">No meetings yet.</p>
              )}
            </div>
          </section>

          {/* Tasks */}
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Tasks</h2>

            <form action={createTask} className="flex items-end gap-3 mb-4 flex-wrap">
              <input type="hidden" name="business_id" value={id} />
              <div>
                <label className="block text-xs text-gray-500 mb-1">Task title</label>
                <input name="title" type="text" placeholder="e.g. Follow up by phone" required className={inputCls + ' w-56'} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Due date</label>
                <input name="due_at" type="date" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Assign to</label>
                <select name="assigned_to" className={inputCls}>
                  {(admins ?? []).map((a: any) => (
                    <option key={a.id} value={a.id}>{a.full_name}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="shrink-0 rounded-lg bg-green-800 px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
                Add task
              </button>
            </form>

            <div className="space-y-2">
              {(tasks ?? []).map((t: any) => (
                <div key={t.id} className={`flex items-center gap-3 p-3 rounded-lg border ${t.status === 'done' ? 'border-gray-100 opacity-50' : 'border-gray-200'}`}>
                  {t.status === 'pending' && (
                    <form action={completeTask}>
                      <input type="hidden" name="task_id" value={t.id} />
                      <button type="submit" className="shrink-0 w-5 h-5 rounded border border-gray-300 hover:border-green-600 hover:bg-green-50 transition-colors" title="Mark done" />
                    </form>
                  )}
                  {t.status === 'done' && <span className="shrink-0 w-5 h-5 flex items-center justify-center text-green-600 text-xs">✓</span>}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${t.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800'}`}>{t.title}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                      {t.profiles?.full_name && <span>{t.profiles.full_name}</span>}
                      {t.due_at && (
                        <span className={new Date(t.due_at) < new Date() && t.status === 'pending' ? 'text-red-500 font-semibold' : ''}>
                          Due {fmt(t.due_at)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {!tasks?.length && <p className="text-sm text-gray-400">No tasks yet.</p>}
            </div>
          </section>

          {/* Activity timeline */}
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Activity timeline</h2>
            <div className="space-y-3">
              {(activity ?? []).map((a: any) => (
                <div key={a.id} className="flex gap-3">
                  <div className="mt-0.5 shrink-0 w-1.5 h-1.5 rounded-full bg-gray-300 mt-2" />
                  <div>
                    <p className="text-sm text-gray-700">{a.description}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {fmtTime(a.created_at)}
                      {a.profiles?.full_name && ` · ${a.profiles.full_name}`}
                    </p>
                  </div>
                </div>
              ))}
              {!activity?.length && <p className="text-sm text-gray-400">No activity recorded yet.</p>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
