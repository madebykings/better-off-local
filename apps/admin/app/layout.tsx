import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Better Off Local – Admin',
  description: 'Internal admin portal',
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
