'use client';

import { useEffect, useRef, useState } from 'react';
import { signOut } from '@/lib/actions/auth';

interface AccountMenuProps {
  email: string;
  name: string | null;
}

// Named alias so AdminShellClient can import without naming clash.
export { AccountMenu as AdminAccountMenu };

export function AccountMenu({ email, name }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const initials = (name ?? email)
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-expanded={open}
        className="w-8 h-8 rounded-full bg-green-800 text-white text-xs font-semibold
                   flex items-center justify-center hover:bg-green-700 transition-colors
                   focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2"
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-56 bg-white rounded-lg shadow-lg
                        border border-gray-200 py-1 z-50">
          <div className="px-3 py-2.5 border-b border-gray-100">
            {name && (
              <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
            )}
            <p className="text-xs text-gray-500 truncate">{email}</p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="w-full text-left px-3 py-2 text-sm text-gray-700
                         hover:bg-gray-50 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
