import { Logo } from '@better-off-local/ui';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo variant="horizontal" scheme="light" height={32} />
        </div>
        {children}
      </div>
    </div>
  );
}
