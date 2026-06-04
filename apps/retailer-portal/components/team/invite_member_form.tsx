'use client';

import { useActionState } from 'react';
import { inviteMember, type TeamActionState } from '@/lib/actions/team';

type Props = { accessRole: string };

const ROLE_OPTIONS = [
  { value: 'manager', label: 'Manager — full access except billing and team management' },
  { value: 'scanner_only', label: 'Scanner — scan QR codes only, no dashboard access' },
];

export function InviteMemberForm({ accessRole }: Props) {
  const [state, action, isPending] = useActionState<TeamActionState, FormData>(
    inviteMember,
    null,
  );

  const availableRoles = accessRole === 'owner' ? ROLE_OPTIONS : ROLE_OPTIONS.filter((r) => r.value === 'scanner_only');

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
      <div>
        <p className="text-sm font-semibold text-gray-800">Invite a team member</p>
        <p className="text-xs text-gray-500 mt-0.5">
          They will receive an email with a sign-in link for their role.
        </p>
      </div>

      {state?.error && (
        <div role="alert" className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}
      {state?.success && (
        <div role="status" className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
          Invite sent. They will receive an email shortly.
        </div>
      )}

      <form action={action} className="space-y-3">
        <div>
          <label htmlFor="invite-email" className="mb-1 block text-sm font-medium text-gray-700">
            Email address <span className="text-red-400">*</span>
          </label>
          <input
            id="invite-email"
            name="email"
            type="email"
            required
            placeholder="colleague@example.com"
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-700/20 focus:border-green-700"
          />
        </div>

        <div>
          <label htmlFor="invite-role" className="mb-1 block text-sm font-medium text-gray-700">
            Role <span className="text-red-400">*</span>
          </label>
          <select
            id="invite-role"
            name="role"
            required
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-700/20 focus:border-green-700 cursor-pointer"
          >
            <option value="">Select role…</option>
            {availableRoles.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-green-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? 'Sending invite…' : 'Send invite'}
        </button>
      </form>
    </div>
  );
}
