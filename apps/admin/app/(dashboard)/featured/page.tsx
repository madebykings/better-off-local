import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Featured – Admin' };

export default function FeaturedPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Featured</h1>
      {/* TODO: implement curated content management, homepage slots */}
    </div>
  );
}
