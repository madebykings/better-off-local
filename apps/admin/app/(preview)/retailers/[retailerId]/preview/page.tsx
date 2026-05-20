import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/service';
import {
  RetailerListingCard,
  type ListingCardData,
} from '@/components/review/retailer_listing_card';

interface Props {
  params: Promise<{ retailerId: string }>;
}

export default async function RetailerPreviewPage({ params }: Props) {
  const { retailerId } = await params;
  const supabase = createServiceClient();

  const [
    { data: retailer },
    { data: categoryRows },
    { data: location },
    { data: links },
    { data: offer },
  ] = await Promise.all([
    supabase
      .from('retailers')
      .select('name, tagline, description, logo_url, cover_image_url, phone, email')
      .eq('id', retailerId)
      .single(),
    supabase
      .from('retailer_categories')
      .select('categories(name, slug)')
      .eq('retailer_id', retailerId),
    supabase
      .from('retailer_locations')
      .select('address_line_1, address_line_2, town, county, postcode, opening_hours_json')
      .eq('retailer_id', retailerId)
      .eq('is_primary', true)
      .maybeSingle(),
    supabase
      .from('retailer_links')
      .select('type, url')
      .eq('retailer_id', retailerId),
    supabase
      .from('offers')
      .select('id, title, value_text, description, offer_type, start_at, end_at')
      .eq('retailer_id', retailerId)
      .eq('onboarding_source', 'first-offer')
      .maybeSingle(),
  ]);

  if (!retailer) notFound();

  let offerRules = null;
  if (offer?.id) {
    const { data: rules } = await supabase
      .from('offer_rules')
      .select('max_redemptions_per_user, max_redemptions_per_day, cooldown_hours, max_redemptions_total')
      .eq('offer_id', offer.id)
      .maybeSingle();
    offerRules = rules ?? null;
  }

  const data: ListingCardData = {
    retailer: {
      name:            retailer.name            ?? null,
      tagline:         retailer.tagline         ?? null,
      description:     retailer.description     ?? null,
      logo_url:        retailer.logo_url        ?? null,
      cover_image_url: retailer.cover_image_url ?? null,
      phone:           retailer.phone           ?? null,
      email:           retailer.email           ?? null,
    },
    categories: (categoryRows ?? [])
      .map((row) => (row.categories as unknown) as { name: string; slug: string } | null)
      .filter((c): c is { name: string; slug: string } => Boolean(c)),
    location: location ?? null,
    links:    links    ?? [],
    offer:    offer    ?? null,
    offerRules,
  };

  return (
    <div className="mx-auto max-w-sm">
      {/* Admin back link */}
      <div className="mb-4 flex items-center justify-between">
        <Link
          href={`/retailers/${retailerId}`}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to admin
        </Link>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
          Admin preview
        </span>
      </div>

      <RetailerListingCard data={data} />
    </div>
  );
}
