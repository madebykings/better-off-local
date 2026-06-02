import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';
import { createTask, completeTask, deleteTask } from '@/lib/actions/crm';

export const metadata: Metadata = { title: 'Tasks – Growth CRM' };

interface Props { searchParams: Promise<{ filter?: string }> }

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isOverdue(iso: string | null) {
  if (!iso) return false;
  return new Date(iso) < new Date();
}

export default async function TasksPage({ searchParams }: Props) {
  const { userId } = await requireAdmin();
  const supabase = createServiceClient();
  const { filter } = await searchParams;

  const [{ data: tasks }, { data: admins }, { data: businesses }] = await Promise.all([
    supabase
      .from('crm_tasks')
      .select('*, profiles(full_name), crm_businesses(id, name)')
      .order('due_at', { ascending: true, nullsFirst: false }),
    supabase.from('profiles').select('id, full_name').order('full_name'),
    supabase.from('crm_businesses').select('id, name').order('name'),
  ]);

  const all = tasks ?? [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const filtered = all.filter((t: any) => {
    if (filter === 'mine') return t.assigned_to === userId;
    if (filter === 'today') {
      if (!t.due_at) return false;
      const d = new Date(t.due_at);
      return d >= today && d < tomorrow;
    }
    if (filter === 'overdue') {
      return t.status === 'pending' && t.due_at && new Date(t.due_at) < today;
    }
    if (filter === 'done') return t.status === 'done';
    return t.status === 'pending';
  });

  const overdueCt = all.filter((t: any) => t.status === 'pending' && t.due_at && new Date(t.due_at) < today).length;
  const todayCt = all.filter((t: any) => {
    if (!t.due_at || t.status !== 'pending') return false;
    const d = new Date(t.due_at);
    return d >= today && d < tomorrow;
  }).length;

  const inputCls = 'rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-700';
  const tabs = [
    { id: 'pending', label: 'Open' },
    { id: 'today',   label: `Today ${todayCt > 0 ? `(${todayCt})` : ''}` },
    { id: 'overdue', label: `Overdue ${overdueCt > 0 ? `(${overdueCt})` : ''}` },
    { id: 'mine',    label: 'Mine' },
    { id: 'done',    label: 'Done' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Tasks</h1>
          <p className="mt-1 text-sm text-gray-500">Follow-ups and actions across all CRM businesses.</p>
        </div>
      </div>

      {/* Summary widgets */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Open tasks',    value: all.filter((t: any) => t.status === 'pending').length, color: 'text-gray-900' },
          { label: 'Due today',     value: todayCt,   color: 'text-amber-700' },
          { label: 'Overdue',       value: overdueCt, color: overdueCt > 0 ? 'text-red-600' : 'text-gray-900' },
          { label: 'Completed',     value: all.filter((t: any) => t.status === 'done').length, color: 'text-green-700' },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick add task */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Add task</h2>
        <form action={createTask} className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Title *</label>
            <input name="title" required type="text" placeholder="e.g. Call Sarah at The Coffee Spot" className={inputCls + ' w-64'} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Business</label>
            <select name="business_id" className={inputCls}>
              <option value="">No business</option>
              {(businesses ?? []).map((b: any) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
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
          <button type="submit" className="rounded-lg bg-green-800 px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            Add
          </button>
        </form>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-4 w-fit">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={`/crm/tasks${t.id === 'pending' ? '' : `?filter=${t.id}`}`}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${(filter ?? 'pending') === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* Task list */}
      <div className="space-y-2">
        {filtered.map((t: any) => (
          <div key={t.id} className={`flex items-start gap-3 p-4 rounded-lg border bg-white ${isOverdue(t.due_at) && t.status === 'pending' ? 'border-red-200' : 'border-gray-200'}`}>
            {t.status === 'pending' ? (
              <form action={completeTask}>
                <input type="hidden" name="task_id" value={t.id} />
                <button type="submit" className="mt-0.5 w-5 h-5 rounded border border-gray-300 hover:border-green-600 hover:bg-green-50 transition-colors shrink-0" title="Mark done" />
              </form>
            ) : (
              <span className="mt-0.5 shrink-0 w-5 h-5 flex items-center justify-center text-green-600 text-xs">✓</span>
            )}
            <div className="flex-1">
              <p className={`text-sm font-medium ${t.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                {t.title}
              </p>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {t.crm_businesses && (
                  <Link href={`/crm/businesses/${t.crm_businesses.id}`} className="text-xs text-green-700 hover:underline">
                    {t.crm_businesses.name}
                  </Link>
                )}
                {t.profiles?.full_name && <span className="text-xs text-gray-400">{t.profiles.full_name}</span>}
                {t.due_at && (
                  <span className={`text-xs ${isOverdue(t.due_at) && t.status === 'pending' ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                    Due {fmt(t.due_at)}
                  </span>
                )}
              </div>
              {t.description && <p className="text-xs text-gray-400 mt-1">{t.description}</p>}
            </div>
            <form action={deleteTask}>
              <input type="hidden" name="task_id" value={t.id} />
              <button type="submit" className="text-xs text-gray-300 hover:text-red-500 transition-colors shrink-0">✕</button>
            </form>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 border border-gray-200 rounded-lg text-gray-400">
            <p className="text-sm">No tasks in this view.</p>
          </div>
        )}
      </div>
    </div>
  );
}
