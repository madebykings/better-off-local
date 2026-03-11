'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '⊞' },
  { href: '/profile', label: 'Profile', icon: '🏪' },
  { href: '/locations', label: 'Locations', icon: '📍' },
  { href: '/offers', label: 'Offers', icon: '🏷️' },
  { href: '/scan', label: 'Scan', icon: '📷' },
  { href: '/redemptions', label: 'Redemptions', icon: '✅' },
  { href: '/billing', label: 'Billing', icon: '💳' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
];

export function RetailerSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r border-gray-200 bg-white flex flex-col">
      <div className="h-14 flex items-center px-4 border-b border-gray-200">
        <span className="font-semibold text-sm text-green-800">
          Better Off Local
        </span>
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
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
