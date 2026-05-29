import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/require_admin';

export const metadata: Metadata = { title: 'Categories – Admin' };

export default async function CategoriesPage() {
  await requireAdmin();
  return (
    <div>
      <h1 className="text-2xl font-semibold">Categories</h1>
      {/* TODO: implement category CRUD, ordering, active/inactive */}
    </div>
  );
}
