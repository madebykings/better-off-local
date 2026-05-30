'use client';

import { useState } from 'react';
import { AdminSidebar } from './admin_sidebar';
import { AdminAccountMenu } from './account_menu';

interface AdminShellClientProps {
  children: React.ReactNode;
  reviewBadge: React.ReactNode;
  email: string;
  name: string | null;
}

function HamburgerIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function AdminShellClient({ children, reviewBadge, email, name }: AdminShellClientProps) {
  const [isNavOpen, setIsNavOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      {/* Mobile overlay */}
      {isNavOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setIsNavOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — always visible on lg+, drawer on mobile */}
      <div
        className={[
          'fixed inset-y-0 left-0 z-40 flex flex-col transition-transform duration-200 lg:relative lg:translate-x-0 lg:z-auto',
          isNavOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <AdminSidebar reviewBadge={reviewBadge} onClose={() => setIsNavOpen(false)} />
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-4 sm:px-6 shrink-0">
          <button
            className="lg:hidden p-1 text-gray-500 hover:text-gray-900 transition-colors"
            onClick={() => setIsNavOpen(true)}
            aria-label="Open navigation"
          >
            <HamburgerIcon />
          </button>
          <div className="hidden lg:block" /> {/* spacer on desktop */}
          <div className="flex items-center gap-3">
            <AdminAccountMenu email={email} name={name} />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
