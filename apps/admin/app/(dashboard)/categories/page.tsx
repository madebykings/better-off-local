import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Categories – Admin' };

export default function CategoriesPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Categories</h1>
      {/* TODO: implement category CRUD, ordering, active/inactive */}
    </div>
  );
}
