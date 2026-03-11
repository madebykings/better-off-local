import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Better Off Local – Retailer Portal',
  description: 'Manage your Better Off Local retailer account',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
