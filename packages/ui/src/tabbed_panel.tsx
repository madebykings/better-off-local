'use client';

import { useState } from 'react';

export type TabDef = {
  id: string;
  label: string;
  /** Optional numeric badge (shown when > 0) */
  badge?: number;
};

type TabbedPanelProps = {
  tabs: TabDef[];
  /** Each panel is keyed by tab id. All panels render; inactive ones are hidden with CSS to preserve React state. */
  panels: { id: string; content: React.ReactNode }[];
  defaultTab?: string;
  className?: string;
};

export function TabbedPanel({ tabs, panels, defaultTab, className }: TabbedPanelProps) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id ?? '');

  return (
    <div className={className}>
      {/* Tab bar — horizontally scrollable on narrow screens */}
      <div className="flex overflow-x-auto border-b border-gray-200 mb-0 -mx-0 scrollbar-none">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={[
              'flex shrink-0 items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap',
              'border-b-2 -mb-px transition-colors focus:outline-none',
              active === tab.id
                ? 'border-green-700 text-green-800'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
            ].join(' ')}
          >
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold leading-none">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Panels — all rendered; only active is visible */}
      {panels.map((panel) => (
        <div key={panel.id} className={panel.id === active ? '' : 'hidden'}>
          {panel.content}
        </div>
      ))}
    </div>
  );
}
