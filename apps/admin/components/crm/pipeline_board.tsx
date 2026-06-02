'use client';

import Link from 'next/link';
import { useState } from 'react';
import { updateBusinessStage } from '@/lib/actions/crm';

export type CrmBizRow = {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  region_name: string | null;
  category: string | null;
  effective_stage: string;
  manual_stage: string;
  assigned_name: string | null;
  next_followup_at: string | null;
  pending_task_count: number;
  email_count: number;
  meeting_count: number;
  onboarding_score: number | null;
  retailer_id: string | null;
  created_at: string;
};

const STAGES = [
  { id: 'lead',            label: 'Lead',            color: 'border-gray-300 bg-gray-50' },
  { id: 'contacted',       label: 'Contacted',       color: 'border-blue-200 bg-blue-50' },
  { id: 'interested',      label: 'Interested',      color: 'border-purple-200 bg-purple-50' },
  { id: 'meeting_booked',  label: 'Meeting Booked',  color: 'border-amber-200 bg-amber-50' },
  { id: 'onboarding',      label: 'Onboarding',      color: 'border-orange-200 bg-orange-50' },
  { id: 'awaiting_content',label: 'Awaiting Content',color: 'border-yellow-200 bg-yellow-50' },
  { id: 'awaiting_offer',  label: 'Awaiting Offer',  color: 'border-cyan-200 bg-cyan-50' },
  { id: 'ready_to_launch', label: 'Ready To Launch', color: 'border-teal-200 bg-teal-50' },
  { id: 'live',            label: 'Live',            color: 'border-green-200 bg-green-50' },
  { id: 'churned',         label: 'Churned',         color: 'border-red-200 bg-red-50' },
] as const;

const STAGE_MAP = Object.fromEntries(STAGES.map((s) => [s.id, s]));

const BADGE: Record<string, string> = {
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function isOverdue(dt: string | null) {
  if (!dt) return false;
  return new Date(dt) < new Date();
}

function StageBadge({ stage }: { stage: string }) {
  const label = STAGE_MAP[stage as keyof typeof STAGE_MAP]?.label ?? stage;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${BADGE[stage] ?? 'bg-gray-100 text-gray-600'}`}>
      {label}
    </span>
  );
}

function OnboardingBar({ score }: { score: number | null }) {
  if (score === null) return null;
  const pct = Math.round((score / 7) * 100);
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <div className="flex-1 h-1 rounded-full bg-gray-200 overflow-hidden">
        <div
          className={`h-full rounded-full ${pct >= 100 ? 'bg-green-500' : 'bg-amber-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-gray-400 tabular-nums">{pct}%</span>
    </div>
  );
}

function KanbanCard({ biz }: { biz: CrmBizRow }) {
  return (
    <Link
      href={`/crm/businesses/${biz.id}`}
      className="block bg-white rounded-lg border border-gray-200 p-3 hover:border-green-400 hover:shadow-sm transition-all"
    >
      <p className="text-sm font-medium text-gray-900 truncate">{biz.name}</p>
      {biz.contact_name && (
        <p className="text-xs text-gray-500 mt-0.5 truncate">{biz.contact_name}</p>
      )}
      {biz.retailer_id && biz.onboarding_score !== null && (
        <OnboardingBar score={biz.onboarding_score} />
      )}
      <div className="flex items-center gap-2 mt-2 text-[11px] text-gray-400">
        {biz.region_name && <span>📍 {biz.region_name}</span>}
        {biz.pending_task_count > 0 && (
          <span className="text-amber-600">⚡ {biz.pending_task_count} task{biz.pending_task_count > 1 ? 's' : ''}</span>
        )}
        {biz.next_followup_at && (
          <span className={isOverdue(biz.next_followup_at) ? 'text-red-500 font-semibold' : ''}>
            🗓 {formatDate(biz.next_followup_at)}
          </span>
        )}
      </div>
    </Link>
  );
}

function KanbanView({ businesses }: { businesses: CrmBizRow[] }) {
  const byStage = Object.fromEntries(STAGES.map((s) => [s.id, [] as CrmBizRow[]]));
  for (const b of businesses) {
    const stage = b.effective_stage in byStage ? b.effective_stage : 'lead';
    byStage[stage].push(b);
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '400px' }}>
      {STAGES.filter((s) => s.id !== 'churned').map((s) => {
        const cards = byStage[s.id] ?? [];
        return (
          <div key={s.id} className="flex-shrink-0 w-52">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-600">{s.label}</h3>
              <span className="text-xs text-gray-400 tabular-nums">{cards.length}</span>
            </div>
            <div className={`rounded-lg border-2 ${s.color} p-2 min-h-24 space-y-2`}>
              {cards.map((b) => <KanbanCard key={b.id} biz={b} />)}
              {cards.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">—</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TableView({ businesses }: { businesses: CrmBizRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Business</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Stage</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Region</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Assigned</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Onboarding</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Follow-up</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {businesses.map((b) => (
            <tr key={b.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3">
                <div className="font-medium text-gray-900">{b.name}</div>
                {b.contact_name && <div className="text-xs text-gray-400">{b.contact_name}</div>}
                {b.email && <div className="text-xs text-gray-400">{b.email}</div>}
              </td>
              <td className="px-4 py-3">
                <StageBadge stage={b.effective_stage} />
              </td>
              <td className="px-4 py-3 text-gray-500 text-xs">{b.region_name ?? '—'}</td>
              <td className="px-4 py-3 text-gray-500 text-xs">{b.assigned_name ?? '—'}</td>
              <td className="px-4 py-3">
                {b.retailer_id && <OnboardingBar score={b.onboarding_score} />}
              </td>
              <td className="px-4 py-3 text-xs">
                {b.next_followup_at ? (
                  <span className={isOverdue(b.next_followup_at) ? 'text-red-500 font-semibold' : 'text-gray-500'}>
                    {formatDate(b.next_followup_at)}
                  </span>
                ) : <span className="text-gray-300">—</span>}
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/crm/businesses/${b.id}`}
                  className="text-sm text-green-700 hover:text-green-900 font-medium"
                >
                  View →
                </Link>
              </td>
            </tr>
          ))}
          {businesses.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">
                No businesses in this pipeline yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function PipelineBoard({ businesses }: { businesses: CrmBizRow[] }) {
  const [view, setView] = useState<'table' | 'kanban'>('table');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [q, setQ] = useState('');

  const filtered = businesses.filter((b) => {
    if (stageFilter !== 'all' && b.effective_stage !== stageFilter) return false;
    if (q && !b.name.toLowerCase().includes(q.toLowerCase())
           && !b.contact_name?.toLowerCase().includes(q.toLowerCase())
           && !b.email?.toLowerCase().includes(q.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <input
          type="search"
          placeholder="Search businesses…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-600 w-56"
        />
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-600"
        >
          <option value="all">All stages</option>
          {STAGES.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        <div className="ml-auto flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setView('table')}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${view === 'table' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Table
          </button>
          <button
            onClick={() => setView('kanban')}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${view === 'kanban' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Kanban
          </button>
        </div>
      </div>

      {view === 'kanban' ? (
        <KanbanView businesses={filtered} />
      ) : (
        <TableView businesses={filtered} />
      )}
    </div>
  );
}
