'use client';

import { useTransition } from 'react';
import { removeStaff } from '@/lib/actions/staff';

export function RemoveStaffButton({ staffId }: { staffId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm('Remove this staff member? They will lose scanner access.')) return;
    startTransition(async () => {
      await removeStaff(staffId);
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50
                 transition-colors font-medium"
    >
      {isPending ? 'Removing…' : 'Remove'}
    </button>
  );
}
