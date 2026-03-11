import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Profile – Retailer Portal' };

export default function ProfilePage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Retailer profile</h1>
      {/* TODO: implement public profile form (name, logo, cover, description, categories) */}
    </div>
  );
}
