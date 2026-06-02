import Link from 'next/link';
import type { ReactNode } from 'react';

const tabs = [
  { href: '/crm/pipeline',  label: 'Pipeline'   },
  { href: '/crm/tasks',     label: 'Tasks'       },
  { href: '/crm/regions',   label: 'Regions'     },
  { href: '/crm/templates', label: 'Templates'   },
];

export default function CrmLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <div className="mb-5 border-b border-gray-200">
        <div className="flex items-center gap-1">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-800 border-b-2 border-transparent hover:border-gray-300 transition-colors -mb-px"
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>
      {children}
    </div>
  );
}
