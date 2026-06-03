'use client';

import { useActionState } from 'react';
import {
  saveDisplayNameAndAccept,
  type InviteActionState,
} from '@/lib/actions/scanner_invites';

export function DisplayNameForm({ token }: { token: string }) {
  const action = saveDisplayNameAndAccept.bind(null, token);
  const [state, formAction, isPending] = useActionState<InviteActionState, FormData>(
    action,
    null,
  );

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div
          role="alert"
          className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
        >
          {state.error}
        </div>
      )}

      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Your name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          autoFocus
          required
          disabled={isPending}
          maxLength={100}
          className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base
                     placeholder:text-gray-400 focus:border-green-600 focus:outline-none
                     focus:ring-1 focus:ring-green-700 disabled:bg-gray-50"
          placeholder="e.g. Sarah"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-green-800 px-4 py-3 text-base font-semibold
                   text-white hover:bg-green-700 disabled:opacity-60
                   disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? 'Setting up…' : 'Start scanning'}
      </button>
    </form>
  );
}
