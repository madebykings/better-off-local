import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/require_admin';

export const metadata: Metadata = { title: 'Featured – Admin' };

export default async function FeaturedPage() {
  await requireAdmin();
  return (
    <div>
      <h1 className="text-2xl font-semibold">Featured</h1>
      {/* TODO: implement curated content management, homepage slots */}
    </div>
  );
}
