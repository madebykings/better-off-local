import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRetailerUser } from '@/lib/auth/require_retailer_user';
import { createServiceClient } from '@/lib/supabase/service';
import { VenueForm } from '../location_form';
import type { VenueFields } from '@/lib/actions/location';
import type { RegionOption } from '../location_form';
import { OpeningHoursEditor } from '@/components/dashboard/opening_hours_editor';
import { VenueImageUpload } from '@/components/dashboard/venue_image_upload';
import { parseOpeningHours } from '@/lib/utils/opening_hours';
import { VenueEditorTabs } from '../venue_editor_tabs';

export const metadata: Metadata = { title: 'Edit Location – Retailer Portal' };

interface Props {
  params: Promise<{ locationId: string }>;
}

export default async function LocationDetailPage({ params }: Props) {
  const { locationId } = await params;
  const { retailerId } = await requireRetailerUser();
  const supabase = createServiceClient();

  const [{ data: loc }, { data: regionRows }] = await Promise.all([
    supabase
      .from('retailer_locations')
      .select('id, name, address_line_1, address_line_2, town, postcode, is_primary, is_active, region_id, opening_hours_json, logo_url, cover_image_url, phone, website_url, short_description, description, review_status, review_notes, submitted_at')
      .eq('id', locationId)
      .eq('retailer_id', retailerId)
      .eq('is_active', true)
      .maybeSingle(),
    supabase
      .from('regions')
      .select('id, name')
      .eq('is_active', true)
      .order('name'),
  ]);
  const regions: RegionOption[] = (regionRows ?? []).map((r) => ({ id: r.id, name: r.name }));

  if (!loc) notFound();

  const initialData: VenueFields = {
    name:             loc.name ?? '',
    regionId:         (loc as any).region_id ?? '',
    addressLine1:     loc.address_line_1 ?? '',
    addressLine2:     loc.address_line_2 ?? '',
    town:             loc.town ?? '',
    postcode:         loc.postcode ?? '',
    phone:            (loc as any).phone ?? '',
    websiteUrl:       (loc as any).website_url ?? '',
    shortDescription: (loc as any).short_description ?? '',
    description:      (loc as any).description ?? '',
  };

  const openingHours = parseOpeningHours((loc as any).opening_hours_json ?? null);

  const reviewStatus = (loc as any).review_status ?? 'draft';
  const reviewNotes  = (loc as any).review_notes  ?? null;
  const locationName = loc.name ?? '';

  const hoursPanel = (
    <div className="max-w-xl">
      <p className="text-sm text-gray-500 mb-4">
        Set your opening hours so members know when you're open.
      </p>
      <OpeningHoursEditor locationId={locationId} initialData={openingHours} />
    </div>
  );

  const imagesPanel = (
    <div className="max-w-xl space-y-5">
      <p className="text-sm text-gray-500">
        Venue-specific images override your retailer-level images for this location.
        Recommended: provide both a logo and a cover image.
      </p>
      <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-5">
        <VenueImageUpload
          locationId={locationId}
          slot="logo"
          label="Venue logo"
          hint="400 × 400 px minimum, square · max 5 MB"
          currentUrl={(loc as any).logo_url ?? null}
        />
        <VenueImageUpload
          locationId={locationId}
          slot="cover"
          label="Cover image"
          hint="1600 × 600 px recommended · max 10 MB"
          currentUrl={(loc as any).cover_image_url ?? null}
        />
      </div>
    </div>
  );

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
          <Link href="/locations" className="hover:text-gray-600 transition-colors">Locations</Link>
          <span>›</span>
          <span className="text-gray-600 truncate">
            {loc.name ?? loc.address_line_1 ?? 'Edit venue'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">{loc.name ?? 'Edit venue'}</h1>
          {loc.is_primary && (
            <span className="rounded border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
              Primary
            </span>
          )}
        </div>
      </div>

      <VenueEditorTabs
        locationName={locationName}
        reviewStatus={reviewStatus}
        reviewNotes={reviewNotes}
        isPrimary={loc.is_primary ?? false}
        detailsPanel={
          <VenueForm
            locationId={locationId}
            initialData={initialData}
            regions={regions}
            reviewStatus={reviewStatus}
            reviewNotes={reviewNotes}
          />
        }
        hoursPanel={hoursPanel}
        imagesPanel={imagesPanel}
      />
    </div>
  );
}
