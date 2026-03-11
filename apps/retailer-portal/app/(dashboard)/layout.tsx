import { RetailerShell } from '@/components/layout/retailer_shell';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RetailerShell>{children}</RetailerShell>;
}
