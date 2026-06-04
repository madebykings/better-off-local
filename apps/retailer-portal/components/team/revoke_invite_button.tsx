'use client';

import { useActionState } from 'react';
import { revokeInvitation, type TeamActionState } from '@/lib/actions/team';

export function RevokeInviteButton({ inviteId }: { inviteId: string }) {
  const [state, action, isPending] = useActionState<TeamActionState, FormData>(
    revokeInvitation,
    null,
  );

  return (
    <form action={action}>
      <input type="hidden" name="inviteId" value={inviteId} />
      <button
        type="submit"
        disabled={isPending}
        className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
      >
        {isPending ? 'Revoking…' : 'Revoke'}
      </button>
    </form>
  );
}
