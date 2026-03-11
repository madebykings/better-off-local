import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Retailer – Admin' };

interface Props {
  params: Promise<{ retailerId: string }>;
}

export default async function RetailerDetailPage({ params }: Props) {
  const { retailerId } = await params;
  return (
    <div>
      <h1 className="text-2xl font-semibold">Retailer detail</h1>
      <p className="text-sm text-gray-400 mt-1">ID: {retailerId}</p>
      {/* TODO: implement retailer detail, approval/rejection, suspension actions */}
    </div>
  );
}
