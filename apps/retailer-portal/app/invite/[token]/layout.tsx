import { Logo } from '@better-off-local/ui';

/**
 * Minimal layout for staff invite pages.
 * No dashboard chrome — staff using these pages have no account yet.
 */
export default function InviteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo variant="horizontal" scheme="light" height={28} />
        </div>
        {children}
      </div>
    </div>
  );
}
