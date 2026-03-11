'use client';

import { useActionState } from 'react';
import { signIn, type AuthActionState } from '@/lib/actions/auth';

export function SignInForm() {
  const [state, action, isPending] = useActionState<AuthActionState, FormData>(
    signIn,
    null,
  );

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
                     focus:ring-1 focus:ring-green-600 disabled:bg-gray-50 disabled:text-gray-500"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={isPending}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm
                     placeholder:text-gray-400 focus:border-green-600 focus:outline-none
                     focus:ring-1 focus:ring-green-600 disabled:bg-gray-50 disabled:text-gray-500"
          placeholder="••••••••"
        />
      </div>

      <div className="flex items-center justify-end">
        <a
          href="/forgot-password"
          className="text-sm text-green-700 hover:text-green-800 hover:underline"
        >
          Forgot password?
        </a>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-green-800 px-4 py-2.5 text-sm font-semibold
                   text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2
                   focus:ring-green-600 focus:ring-offset-2 disabled:opacity-60
                   disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
