'use client';

import { useActionState } from 'react';
import { requestMagicLink, type InviteActionState } from '@/lib/actions/scanner_invites';

export function MagicLinkForm({ token }: { token: string }) {
  const action = requestMagicLink.bind(null, token);
  const [state, formAction, isPending] = useActionState<InviteActionState, FormData>(
    action,
    null,
  );

  if (state?.success) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-5 text-center space-y-2">
        <p className="text-2xl">📧</p>
        <p className="font-semibold text-green-800">Check your email</p>
        <p className="text-sm text-green-700">
          We sent a sign-in link. Tap it on this phone to continue.
        </p>
      </div>
    );
  }

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
          htmlFor="email"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Your email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          disabled={isPending}
          className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base
                     placeholder:text-gray-400 focus:border-green-600 focus:outline-none
                     focus:ring-1 focus:ring-green-600 disabled:bg-gray-50"
          placeholder="you@example.com"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-green-800 px-4 py-3 text-base font-semibold
                   text-white hover:bg-green-700 disabled:opacity-60
                   disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? 'Sending…' : 'Get sign-in link'}
      </button>

      <p className="text-xs text-center text-gray-400">
        We&apos;ll email you a one-tap sign-in link. No password needed.
      </p>
    </form>
  );
}
