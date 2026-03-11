import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Member – Admin' };

interface Props {
  params: Promise<{ memberId: string }>;
}

export default async function MemberDetailPage({ params }: Props) {
  const { memberId } = await params;
  return (
    <div>
      <h1 className="text-2xl font-semibold">Member detail</h1>
      <p className="text-sm text-gray-400 mt-1">ID: {memberId}</p>
      {/* TODO: membership state, redemption history, support context */}
    </div>
  );
}
