'use client';

import { useState, useTransition } from 'react';

type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'suspended'
  | 'changes_requested';

interface ReviewActionPanelProps {
  retailerId: string;
  currentStatus: ApprovalStatus;
  approveAction:        (retailerId: string) => Promise<void>;
  rejectAction:         (retailerId: string, note: string) => Promise<void>;
  requestChangesAction: (retailerId: string, note: string) => Promise<void>;
}

type ActiveAction = 'reject' | 'changes' | null;

export function ReviewActionPanel({
  retailerId,
  currentStatus,
  approveAction,
  rejectAction,
  requestChangesAction,
}: ReviewActionPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [active, setActive] = useState<ActiveAction>(null);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState('');

  function cancel() {
    setActive(null);
    setNote('');
    setNoteError('');
  }

  function handleApprove() {
    startTransition(async () => {
      await approveAction(retailerId);
    });
  }

  function handleNoteSubmit() {
    if (note.trim().length < 10) {
      setNoteError('Please provide a note of at least 10 characters.');
      return;
    }
    setNoteError('');
    startTransition(async () => {
      if (active === 'reject') {
        await rejectAction(retailerId, note.trim());
      } else if (active === 'changes') {
        await requestChangesAction(retailerId, note.trim());
      }
      cancel();
    });
  }

  const isApproved         = currentStatus === 'approved';
  const isRejected         = currentStatus === 'rejected';
  const isChangesRequested = currentStatus === 'changes_requested';

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-gray-700">Moderation actions</h2>

      {/* Current status */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-xs text-gray-500">Current status:</span>
        <StatusBadge status={currentStatus} />
      </div>

      {/* Action buttons (hidden when a note form is active) */}
      {active === null && (
        <div className="flex flex-wrap gap-2">
          {!isApproved && (
            <button
              onClick={handleApprove}
              disabled={isPending}
              className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white
                         transition-colors hover:bg-green-800 disabled:opacity-50"
            >
              {isPending ? 'Working…' : 'Approve'}
            </button>
          )}
          {!isChangesRequested && (
            <button
              onClick={() => setActive('changes')}
              disabled={isPending}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white
                         transition-colors hover:bg-amber-600 disabled:opacity-50"
            >
              Request changes
            </button>
          )}
          {!isRejected && (
            <button
              onClick={() => setActive('reject')}
              disabled={isPending}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white
                         transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              Reject
            </button>
          )}
        </div>
      )}

      {/* Note input form for reject / request changes */}
      {active !== null && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">
            {active === 'reject'
              ? 'Reason for rejection — visible to retailer:'
              : 'Changes required — explain what needs updating:'}
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              active === 'reject'
                ? 'e.g. "Listing content does not meet community standards."'
                : 'e.g. "Please add a cover image and at least one opening day."'
            }
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                       focus:outline-none focus:ring-1 focus:ring-green-700"
            autoFocus
          />
          {noteError && (
            <p className="text-xs text-red-600">{noteError}</p>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={handleNoteSubmit}
              disabled={isPending}
              className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 ${
                active === 'reject'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-amber-500 hover:bg-amber-600'
              }`}
            >
              {isPending
                ? 'Working…'
                : active === 'reject'
                  ? 'Confirm rejection'
                  : 'Send change request'}
            </button>
            <button
              onClick={cancel}
              disabled={isPending}
              className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatusBadge helper (used by ReviewActionPanel and detail page header)
// ---------------------------------------------------------------------------

const STATUS_CLASSES: Record<string, string> = {
  pending:           'bg-amber-100 text-amber-800 border-amber-200',
  approved:          'bg-green-100 text-green-800 border-green-200',
  rejected:          'bg-red-100 text-red-800 border-red-200',
  suspended:         'bg-gray-200 text-gray-700 border-gray-300',
  changes_requested: 'bg-orange-100 text-orange-800 border-orange-200',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium border capitalize
        ${STATUS_CLASSES[status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}
    >
      {status.replace('_', ' ')}
    </span>
  );
}
