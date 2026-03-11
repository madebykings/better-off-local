import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Members – Admin' };

export default function MembersPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Members</h1>
      {/* TODO: implement member lookup, membership state visibility */}
    </div>
  );
}
