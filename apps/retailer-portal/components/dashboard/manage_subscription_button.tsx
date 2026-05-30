'use client';

import { useTransition } from 'react';
import { openBillingPortal } from '@/lib/actions/billing';

export function ManageSubscriptionButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(() => openBillingPortal())}
      disabled={isPending}
      className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium
                 text-gray-700 hover:bg-gray-50 transition-colors
                 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isPending ? 'Opening…' : 'Manage subscription'}
    </button>
  );
}
