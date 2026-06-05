type StickyActionBarProps = {
  children: React.ReactNode;
  /** Additional class names for the bar container */
  className?: string;
};

/**
 * Fixed action bar pinned to the bottom of the viewport on mobile,
 * and sticky at the bottom of its nearest scroll container on larger screens.
 * Wrap primary form actions (Save, Submit, etc.) inside this.
 */
export function StickyActionBar({ children, className }: StickyActionBarProps) {
  return (
    <div
      className={[
        'sticky bottom-0 z-20 bg-white/95 backdrop-blur border-t border-gray-200',
        'px-4 py-3 flex items-center gap-3 flex-wrap',
        className ?? '',
      ].join(' ')}
    >
      {children}
    </div>
  );
}
