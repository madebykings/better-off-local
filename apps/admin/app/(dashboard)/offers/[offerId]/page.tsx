import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Offer – Admin' };

interface Props {
  params: Promise<{ offerId: string }>;
}

export default async function OfferDetailPage({ params }: Props) {
  const { offerId } = await params;
  return (
    <div>
      <h1 className="text-2xl font-semibold">Offer detail</h1>
      <p className="text-sm text-gray-400 mt-1">ID: {offerId}</p>
      {/* TODO: implement offer moderation actions */}
    </div>
  );
}
