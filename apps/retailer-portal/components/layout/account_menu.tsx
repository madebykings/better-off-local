'use client';

import { useEffect, useRef, useState } from 'react';
import { signOut } from '@/lib/actions/auth';

interface AccountMenuProps {
  email: string;
  logoUrl?: string | null;
  retailerName?: string | null;
}

export function AccountMenu({ email, logoUrl, retailerName }: AccountMenuProps) {
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

  const initial = (email[0] ?? '').toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-expanded={open}
        className="w-8 h-8 rounded-full overflow-hidden bg-green-800 text-white text-xs font-semibold
                   flex items-center justify-center hover:ring-2 hover:ring-green-600 hover:ring-offset-1
                   transition-all focus:outline-none focus:ring-2 focus:ring-green-700 focus:ring-offset-2"
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={retailerName ?? 'Logo'}
            className="w-full h-full object-cover"
          />
        ) : (
          initial
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-56 bg-white rounded-lg shadow-lg
                        border border-gray-200 py-1 z-50">
          <div className="px-3 py-2.5 border-b border-gray-100">
            {retailerName && (
              <p className="text-xs font-medium text-gray-700 truncate mb-0.5">{retailerName}</p>
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
