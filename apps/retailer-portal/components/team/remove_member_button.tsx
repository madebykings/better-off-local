'use client';

import { useTransition } from 'react';
import { removeMember } from '@/lib/actions/team';

export function RemoveMemberButton({ memberId, memberName }: { memberId: string; memberName: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm(`Remove ${memberName} from your team? They will lose access immediately.`)) return;
    startTransition(async () => {
      await removeMember(memberId);
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50 transition-colors font-medium"
    >
      {isPending ? 'Removing…' : 'Remove'}
    </button>
  );
}
