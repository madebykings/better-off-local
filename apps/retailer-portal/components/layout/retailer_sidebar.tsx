'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@better-off-local/ui';

const ALL_NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: '⊞' },
  { href: '/profile', label: 'Profile', icon: '🏪' },
  { href: '/locations', label: 'Locations', icon: '📍' },
  { href: '/offers', label: 'Offers', icon: '🏷️' },
  { href: '/scan', label: 'Scan', icon: '📷' },
  { href: '/redemptions', label: 'Redemptions', icon: '✅' },
  { href: '/analytics', label: 'Analytics', icon: '📊' },
  { href: '/billing', label: 'Billing', icon: '💳' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
];

const SCANNER_ONLY_NAV_ITEMS = [
  { href: '/scan', label: 'Scan', icon: '📷' },
];

export function RetailerSidebar({
  accessRole,
  onClose,
}: {
  accessRole: string;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const navItems =
    accessRole === 'scanner_only' ? SCANNER_ONLY_NAV_ITEMS : ALL_NAV_ITEMS;

  return (
    <aside className="w-56 shrink-0 border-r border-gray-200 bg-white flex flex-col h-full">
      <div className="h-14 flex items-center justify-between px-4 border-b border-gray-200 shrink-0">
        <Logo variant="horizontal" scheme="light" height={22} />
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1 text-gray-400 hover:text-gray-600"
            aria-label="Close navigation"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <nav className="flex-1 py-4 space-y-0.5 px-2 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-green-50 text-green-800 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
