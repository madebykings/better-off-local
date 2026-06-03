'use client';

import { useActionState, useState } from 'react';
import { sendPasswordReset, type AuthActionState } from '@/lib/actions/auth';

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);

  const [state, action, isPending] = useActionState<AuthActionState, FormData>(
    async (prevState, formData) => {
      const result = await sendPasswordReset(prevState, formData);
      if (!result?.error) setSent(true);
      return result;
    },
    null,
  );

  if (sent) {
    return (
      <div className="text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <svg
            className="h-6 w-6 text-green-700"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Check your email</h2>
        <p className="text-sm text-gray-500">
          If an account exists for that address, you will receive a reset link
          shortly.
        </p>
        <a
          href="/sign-in"
          className="inline-block text-sm text-green-700 hover:text-green-800 hover:underline"
        >
          Back to sign in
        </a>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
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
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={isPending}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm
                     placeholder:text-gray-400 focus:border-green-600 focus:outline-none
                     focus:ring-1 focus:ring-green-700 disabled:bg-gray-50 disabled:text-gray-500"
          placeholder="you@example.com"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-green-800 px-4 py-2.5 text-sm font-semibold
                   text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2
                   focus:ring-green-700 focus:ring-offset-2 disabled:opacity-60
                   disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? 'Sending…' : 'Send reset link'}
      </button>

      <p className="text-center text-sm text-gray-500">
        <a
          href="/sign-in"
          className="text-green-700 hover:text-green-800 hover:underline"
        >
          Back to sign in
        </a>
      </p>
    </form>
  );
}
