'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@better-off-local/ui';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '⊞' },
  { href: '/review',    label: 'Review',    icon: '🔍' },
  { href: '/retailers', label: 'Retailers', icon: '🏪' },
  { href: '/offers',    label: 'Offers',    icon: '🏷️' },
  { href: '/members',   label: 'Members',   icon: '👥' },
  { href: '/redemptions', label: 'Redemptions', icon: '✅' },
  { href: '/categories',  label: 'Categories',  icon: '📂' },
  { href: '/subscriptions', label: 'Subscriptions', icon: '💳' },
  { href: '/featured',  label: 'Featured',  icon: '⭐' },
  { href: '/audit',     label: 'Audit',     icon: '📋' },
  { href: '/settings',  label: 'Settings',  icon: '⚙️' },
];

interface AdminSidebarProps {
  /** Server component badge rendered into the Review nav item. */
  reviewBadge?: React.ReactNode;
}

export function AdminSidebar({ reviewBadge }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r border-gray-200 bg-white flex flex-col">
      <div className="h-14 flex items-center px-4 border-b border-gray-200">
        <Logo variant="icon" scheme="light" height={28} />
        <span className="text-xs text-gray-500 ml-1.5">Admin</span>
      </div>
      <nav className="flex-1 py-4 space-y-0.5 px-2">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
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
