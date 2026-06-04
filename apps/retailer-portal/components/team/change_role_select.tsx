'use client';

import { useTransition, useState } from 'react';
import { changeRole } from '@/lib/actions/team';

const ROLE_OPTIONS = [
  { value: 'owner', label: 'Owner' },
  { value: 'manager', label: 'Manager' },
  { value: 'scanner_only', label: 'Scanner' },
];

export function ChangeRoleSelect({ memberId, currentRole }: { memberId: string; currentRole: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleChange(newRole: string) {
    if (newRole === currentRole) return;
    if (!confirm(`Change role to ${ROLE_OPTIONS.find((r) => r.value === newRole)?.label}?`)) return;
    setError(null);
    startTransition(async () => {
      const result = await changeRole(memberId, newRole);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div>
      <select
        value={currentRole}
        onChange={(e) => handleChange(e.target.value)}
        disabled={isPending}
        className="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-green-700/30 disabled:opacity-50"
      >
        {ROLE_OPTIONS.map((r) => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
