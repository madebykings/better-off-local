'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@better-off-local/ui';

const navItems = [
  { href: '/dashboard',     label: 'Dashboard',     icon: '⊞' },
  { href: '/review',        label: 'Review',        icon: '🔍' },
  { href: '/crm',           label: 'Growth CRM',    icon: '📈' },
  { href: '/retailers',     label: 'Retailers',     icon: '🏪' },
  { href: '/offers',        label: 'Offers',        icon: '🏷️' },
  { href: '/members',       label: 'Members',       icon: '👥' },
  { href: '/redemptions',   label: 'Redemptions',   icon: '✅' },
  { href: '/regions',       label: 'Regions',       icon: '🗺️' },
  { href: '/categories',    label: 'Categories',    icon: '📂' },
  { href: '/subscriptions', label: 'Subscriptions', icon: '💳' },
  { href: '/featured',      label: 'Featured',      icon: '⭐' },
  { href: '/referrals',     label: 'Referrals',     icon: '🎁' },
  { href: '/revenue',       label: 'Revenue',       icon: '💰' },
  { href: '/content',       label: 'Content',       icon: '✏️' },
  { href: '/audit',         label: 'Audit',         icon: '📋' },
  { href: '/settings',      label: 'Settings',      icon: '⚙️' },
];

interface AdminSidebarProps {
  reviewBadge?: React.ReactNode;
  onClose?: () => void;
}

export function AdminSidebar({ reviewBadge, onClose }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r border-gray-200 bg-white flex flex-col h-full">
      <div className="h-14 flex items-center justify-between px-4 border-b border-gray-200 shrink-0">
        <div className="flex items-center">
          <Logo variant="icon" scheme="light" height={28} />
          <span className="text-xs text-gray-500 ml-1.5">Admin</span>
        </div>
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
              {item.href === '/review' && reviewBadge}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
