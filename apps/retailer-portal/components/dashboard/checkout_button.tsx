'use client';

import { useActionState } from 'react';
import { startCheckout, type CheckoutState } from '@/lib/actions/billing';

interface Props {
  label: string;
  hint?: string;
  variant?: 'primary' | 'outline';
}

const initial: CheckoutState = { error: null };

export function CheckoutButton({ label, hint, variant = 'primary' }: Props) {
  const [state, formAction, isPending] = useActionState(startCheckout, initial);

  const buttonCls =
    variant === 'outline'
      ? 'w-full rounded-lg border border-green-600 px-4 py-2.5 text-sm font-semibold text-green-700 transition-colors hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50'
      : 'w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50';

  return (
    <form action={formAction}>
      {state.error && (
        <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={isPending} className={buttonCls}>
        {isPending ? 'Redirecting to checkout…' : label}
      </button>
      {hint && (
        <p className="mt-2 text-center text-xs text-gray-400">{hint}</p>
      )}
    </form>
  );
}
