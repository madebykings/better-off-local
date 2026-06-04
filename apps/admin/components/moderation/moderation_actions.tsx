'use client';

import { useTransition, useState } from 'react';

interface ActionButtonProps {
  label: string;
  action: (reason?: string) => Promise<void>;
  variant: 'approve' | 'reject' | 'warn' | 'neutral';
  requireReason?: boolean;
  confirmMessage?: string;
}

function ActionButton({ label, action, variant, requireReason, confirmMessage }: ActionButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [reason, setReason] = useState('');

  const variantClasses = {
    approve: 'bg-green-700 hover:bg-green-800 text-white',
    reject: 'bg-red-600 hover:bg-red-700 text-white',
    warn: 'bg-amber-500 hover:bg-amber-600 text-white',
    neutral: 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300',
  };

  function handleClick() {
    if (requireReason && !showReasonInput) {
      setShowReasonInput(true);
      return;
    }
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    startTransition(async () => {
      await action(reason || undefined);
      setShowReasonInput(false);
      setReason('');
    });
  }

  return (
    <div>
      {showReasonInput && (
        <div className="mb-2">
          <input
            type="text"
            placeholder="Reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full text-sm border border-gray-300 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-700"
            autoFocus
          />
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
          onClick={() => { setShowReasonInput(false); setReason(''); }}
          className="ml-2 text-xs text-gray-500 underline"
        >
          Cancel
        </button>
      )}
    </div>
  );
}

// ─── Retailer moderation actions ──────────────────────────────────────────────

interface RetailerActionsProps {
  retailerId: string;
  currentApprovalStatus: string;
  approveAction: (retailerId: string, reason?: string) => Promise<void>;
  rejectAction: (retailerId: string, reason?: string) => Promise<void>;
  suspendAction: (retailerId: string, reason?: string) => Promise<void>;
  setVisibilityAction: (retailerId: string, v: 'live' | 'hidden' | 'draft', reason?: string) => Promise<void>;
}

export function RetailerModerationActions({
  retailerId, currentApprovalStatus,
  approveAction, rejectAction, suspendAction, setVisibilityAction,
}: RetailerActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {currentApprovalStatus !== 'approved' && (
        <ActionButton
          label="Approve"
          action={(r) => approveAction(retailerId, r)}
          variant="approve"
          requireReason={false}
          confirmMessage="Approve this retailer? They will become publicly visible."
        />
      )}
      {currentApprovalStatus !== 'rejected' && (
        <ActionButton
          label="Reject"
          action={(r) => rejectAction(retailerId, r)}
          variant="reject"
          requireReason={true}
        />
      )}
      {currentApprovalStatus !== 'suspended' && (
        <ActionButton
          label="Suspend"
          action={(r) => suspendAction(retailerId, r)}
          variant="warn"
          requireReason={true}
        />
      )}
      <ActionButton
        label="Hide"
        action={(r) => setVisibilityAction(retailerId, 'hidden', r)}
        variant="neutral"
        requireReason={false}
        confirmMessage="Hide this retailer from public discovery?"
      />
    </div>
  );
}

// ─── Offer moderation actions ─────────────────────────────────────────────────

interface OfferActionsProps {
  offerId: string;
  currentStatus: string;
  approveAction: (offerId: string, reason?: string) => Promise<void>;
  rejectAction: (offerId: string, reason?: string) => Promise<void>;
  pauseAction: (offerId: string, reason?: string) => Promise<void>;
  reinstateAction: (offerId: string, reason?: string) => Promise<void>;
}

export function OfferModerationActions({
  offerId, currentStatus,
  approveAction, rejectAction, pauseAction, reinstateAction,
}: OfferActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {(currentStatus === 'pending' || currentStatus === 'paused' || currentStatus === 'rejected') && (
        <ActionButton
          label="Approve & go live"
          action={(r) => approveAction(offerId, r)}
          variant="approve"
          confirmMessage="Approve this offer and make it live?"
        />
      )}
      {currentStatus !== 'rejected' && (
        <ActionButton
          label="Reject"
          action={(r) => rejectAction(offerId, r)}
          variant="reject"
          requireReason={true}
        />
      )}
      {currentStatus === 'live' && (
        <ActionButton
          label="Pause"
          action={(r) => pauseAction(offerId, r)}
          variant="warn"
          requireReason={false}
          confirmMessage="Pause this offer? It will stop appearing publicly."
        />
      )}
      {currentStatus === 'paused' && (
        <ActionButton
          label="Reinstate"
          action={(r) => reinstateAction(offerId, r)}
          variant="neutral"
          confirmMessage="Reinstate this offer as live?"
        />
      )}
    </div>
  );
}
