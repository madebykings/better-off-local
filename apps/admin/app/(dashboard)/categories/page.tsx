import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';
import { toggleCategoryActive, createCategory } from '@/lib/actions/admin';

export const metadata: Metadata = { title: 'Categories – Admin' };

export default async function CategoriesPage() {
  await requireAdmin();
  const supabase = createServiceClient();

  const { data: rows } = await supabase
    .from('categories')
    .select('id, name, slug, icon, sort_order, is_active')
    .order('sort_order')
    .order('name');

  const categories = (rows ?? []) as {
    id: string; name: string; slug: string; icon: string | null;
    sort_order: number; is_active: boolean;
  }[];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Categories</h1>
        <p className="mt-1 text-sm text-gray-500">
          Platform category taxonomy used for retailer and offer classification.
        </p>
      </div>

      {/* Add category */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Add category</h2>
        <form action={createCategory} className="flex items-end gap-3 flex-wrap">
          <div>
            <label htmlFor="cat-name" className="block text-xs text-gray-500 mb-1">Name *</label>
            <input
              id="cat-name"
              name="name"
              type="text"
              placeholder="e.g. Health & Wellness"
              required
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-700 w-56"
            />
          </div>
          <div>
            <label htmlFor="cat-icon" className="block text-xs text-gray-500 mb-1">Icon (emoji)</label>
            <input
              id="cat-icon"
              name="icon"
              type="text"
              placeholder="🍕"
              maxLength={4}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-center text-lg focus:outline-none focus:ring-1 focus:ring-green-700 w-20"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-green-800 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            Add
          </button>
        </form>
      </div>

      {/* Categories table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Slug</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Icon</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Order</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {categories.map((c) => (
              <tr key={c.id} className={`hover:bg-gray-50 ${!c.is_active ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 font-medium text-gray-800">{c.name}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{c.slug}</td>
                <td className="px-4 py-3 text-gray-500">{c.icon ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500">{c.sort_order}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                    c.is_active
                      ? 'bg-green-100 text-green-800 border-green-200'
                      : 'bg-gray-100 text-gray-500 border-gray-200'
                  }`}>
                    {c.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <form action={toggleCategoryActive}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="is_active" value={String(c.is_active)} />
                    <button
                      type="submit"
                      className="text-xs text-gray-500 hover:text-gray-800 underline"
                    >
                      {c.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-2.5 border-t border-gray-100 text-xs text-gray-400">
          {categories.length} categor{categories.length !== 1 ? 'ies' : 'y'}
        </div>
      </div>
    </div>
  );
}
