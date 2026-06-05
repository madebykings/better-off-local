'use client';

import { useTransition, useState } from 'react';

// ─── Generic action button ────────────────────────────────────────────────────

interface ActionButtonProps {
  label: string;
  action: (reason?: string) => Promise<{ error?: string }>;
  variant: 'approve' | 'reject' | 'warn' | 'neutral';
  requireReason?: boolean;
  requireReasonLabel?: string;
  confirmMessage?: string;
}

function ActionButton({
  label,
  action,
  variant,
  requireReason,
  requireReasonLabel,
  confirmMessage,
}: ActionButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const variantClasses = {
    approve: 'bg-green-700 hover:bg-green-800 text-white',
    reject:  'bg-red-600 hover:bg-red-700 text-white',
    warn:    'bg-amber-500 hover:bg-amber-600 text-white',
    neutral: 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300',
  };

  function handleClick() {
    if (requireReason && !showReasonInput) {
      setShowReasonInput(true);
      return;
    }
    if (requireReason && !reason.trim()) {
      setErrorMsg('A reason is required.');
      return;
    }
    if (confirmMessage && !window.confirm(confirmMessage)) return;

    setErrorMsg('');
    startTransition(async () => {
      const result = await action(reason || undefined);
      if (result?.error) {
        setErrorMsg(result.error);
      } else {
        setShowReasonInput(false);
        setReason('');
      }
    });
  }

  return (
    <div>
      {showReasonInput && (
        <div className="mb-2">
          <textarea
            placeholder={requireReasonLabel ?? 'Reason (required)'}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className="w-full text-sm border border-gray-300 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-700 resize-none"
            autoFocus
          />
          {errorMsg && <p className="text-xs text-red-600 mt-1">{errorMsg}</p>}
        </div>
      )}
      <button
        onClick={handleClick}
        disabled={isPending}
        className={`px-3 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50 ${variantClasses[variant]}`}
      >
        {isPending ? 'Working…' : showReasonInput ? `Confirm ${label}` : label}
      </button>
      {showReasonInput && (
        <button
          onClick={() => { setShowReasonInput(false); setReason(''); setErrorMsg(''); }}
          className="ml-2 text-xs text-gray-500 underline"
        >
          Cancel
        </button>
      )}
      {!showReasonInput && errorMsg && (
        <p className="text-xs text-red-600 mt-1">{errorMsg}</p>
      )}
    </div>
  );
}

// ─── Feature toggle ───────────────────────────────────────────────────────────

interface FeatureToggleProps {
  eventId: string;
  isFeatured: boolean;
  featureAction: (eventId: string, featured: boolean) => Promise<{ error?: string }>;
}

function FeatureToggle({ eventId, isFeatured, featureAction }: FeatureToggleProps) {
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState('');

  function handleToggle() {
    setErrorMsg('');
    startTransition(async () => {
      const result = await featureAction(eventId, !isFeatured);
      if (result?.error) setErrorMsg(result.error);
    });
  }

  return (
    <div>
      <button
        onClick={handleToggle}
        disabled={isPending}
        className={`px-3 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50 border ${
          isFeatured
            ? 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200'
            : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
        }`}
      >
        {isPending ? 'Working…' : isFeatured ? '&#9733; Unfeature' : '&#9734; Feature'}
      </button>
      {errorMsg && <p className="text-xs text-red-600 mt-1">{errorMsg}</p>}
    </div>
  );
}

// ─── Event moderation actions ─────────────────────────────────────────────────

interface EventModerationActionsProps {
  eventId: string;
  currentStatus: string;
  isFeatured: boolean;
  approveAction: (eventId: string, note?: string) => Promise<{ error?: string }>;
  rejectAction:  (eventId: string, note: string)  => Promise<{ error?: string }>;
  pauseAction:   (eventId: string, reason?: string) => Promise<{ error?: string }>;
  archiveAction: (eventId: string) => Promise<{ error?: string }>;
  featureAction: (eventId: string, featured: boolean) => Promise<{ error?: string }>;
}

export function EventModerationActions({
  eventId,
  currentStatus,
  isFeatured,
  approveAction,
  rejectAction,
  pauseAction,
  archiveAction,
  featureAction,
}: EventModerationActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {/* pending → Approve or Reject */}
      {currentStatus === 'pending' && (
        <>
          <ActionButton
            label="Approve"
            action={(note) => approveAction(eventId, note)}
            variant="approve"
            confirmMessage="Approve this event and make it live?"
          />
          <ActionButton
            label="Reject"
            action={(note) => rejectAction(eventId, note ?? '')}
            variant="reject"
            requireReason
            requireReasonLabel="Rejection reason (required)"
          />
        </>
      )}

      {/* live → Pause, Archive, Feature toggle */}
      {currentStatus === 'live' && (
        <>
          <ActionButton
            label="Pause"
            action={(reason) => pauseAction(eventId, reason)}
            variant="warn"
            confirmMessage="Pause this event? It will stop appearing publicly."
          />
          <ActionButton
            label="Archive"
            action={() => archiveAction(eventId)}
            variant="neutral"
            confirmMessage="Archive this event? It will be hidden permanently."
          />
          <FeatureToggle eventId={eventId} isFeatured={isFeatured} featureAction={featureAction} />
        </>
      )}

      {/* paused → Reinstate (live) or Archive */}
      {currentStatus === 'paused' && (
        <>
          <ActionButton
            label="Reinstate"
            action={(note) => approveAction(eventId, note)}
            variant="approve"
            confirmMessage="Reinstate this event as live?"
          />
          <ActionButton
            label="Archive"
            action={() => archiveAction(eventId)}
            variant="neutral"
            confirmMessage="Archive this event?"
          />
        </>
      )}

      {/* rejected → Re-approve or Archive */}
      {currentStatus === 'rejected' && (
        <>
          <ActionButton
            label="Re-approve"
            action={(note) => approveAction(eventId, note)}
            variant="approve"
            confirmMessage="Re-approve this event and make it live?"
          />
          <ActionButton
            label="Archive"
            action={() => archiveAction(eventId)}
            variant="neutral"
            confirmMessage="Archive this event?"
          />
        </>
      )}

      {/* archived → no moderation actions (terminal state) */}
      {currentStatus === 'archived' && (
        <p className="text-sm text-gray-400 italic">This event is archived.</p>
      )}
    </div>
  );
}
