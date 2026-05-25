'use client';

import { useActionState, useTransition } from 'react';
import {
  createInviteLink,
  revokeInviteLink,
  type InviteActionState,
} from '@/lib/actions/scanner_invites';

type ActiveInvite = {
  id: string;
  token: string;
  expiresAt: string;
};

type Props = {
  appUrl: string;
  activeInvite: ActiveInvite | null;
};

function inviteUrl(appUrl: string, token: string) {
  return `${appUrl}/invite/${token}`;
}

function formatExpiry(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function InviteLinkSection({ appUrl, activeInvite }: Props) {
  const [createState, createAction, isCreating] = useActionState<InviteActionState, FormData>(
    createInviteLink,
    null,
  );
  const [revokeState, revokeAction, isRevoking] = useActionState<InviteActionState, FormData>(
    revokeInviteLink,
    null,
  );

  const [isCopying, startCopy] = useTransition();
  const [isSharing, startShare] = useTransition();

  const url = activeInvite ? inviteUrl(appUrl, activeInvite.token) : null;

  function handleCopy() {
    if (!url) return;
    startCopy(async () => {
      await navigator.clipboard.writeText(url);
    });
  }

  function handleShare() {
    if (!url) return;
    startShare(async () => {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: 'Join as a scanner', url });
      } else {
        await navigator.clipboard.writeText(url);
      }
    });
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
      <div>
        <p className="text-sm font-medium text-gray-700">Scanner invite link</p>
        <p className="text-xs text-gray-500 mt-0.5">
          Share this link with staff. Anyone with the link can join as a scanner
          until it expires or is revoked.
        </p>
      </div>

      {(createState?.error || revokeState?.error) && (
        <div
          role="alert"
          className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700"
        >
          {createState?.error ?? revokeState?.error}
        </div>
      )}

      {activeInvite && url ? (
        <div className="space-y-3">
          {/* Link display */}
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <span className="flex-1 truncate text-xs text-gray-600 font-mono">{url}</span>
          </div>

          <p className="text-xs text-gray-400">
            Expires {formatExpiry(activeInvite.expiresAt)}
          </p>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCopy}
              disabled={isCopying}
              className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm
                         font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60
                         transition-colors"
            >
              {isCopying ? 'Copied!' : 'Copy link'}
            </button>

            <button
              type="button"
              onClick={handleShare}
              disabled={isSharing}
              className="flex-1 rounded-lg bg-green-800 px-3 py-2 text-sm font-medium
                         text-white hover:bg-green-700 disabled:opacity-60 transition-colors"
            >
              Share
            </button>
          </div>

          {/* Revoke */}
          <form action={revokeAction}>
            <input type="hidden" name="inviteId" value={activeInvite.id} />
            <button
              type="submit"
              disabled={isRevoking}
              className="text-xs text-gray-400 hover:text-red-600 underline-offset-2
                         hover:underline transition-colors disabled:opacity-60"
            >
              {isRevoking ? 'Revoking…' : 'Revoke link'}
            </button>
          </form>
        </div>
      ) : (
        <form action={createAction}>
          <button
            type="submit"
            disabled={isCreating}
            className="w-full rounded-lg bg-green-800 px-4 py-2.5 text-sm font-semibold
                       text-white hover:bg-green-700 disabled:opacity-60
                       disabled:cursor-not-allowed transition-colors"
          >
            {isCreating ? 'Generating…' : 'Generate invite link'}
          </button>
        </form>
      )}
    </div>
  );
}
