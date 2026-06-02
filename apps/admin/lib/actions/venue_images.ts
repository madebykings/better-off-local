'use server';

import sharp from 'sharp';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';

// ---------------------------------------------------------------------------
// Constants — must match retailer-portal/lib/actions/branding.ts
// ---------------------------------------------------------------------------

const BUCKET = 'retailer-assets';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const LOGO_MAX_BYTES  = 5  * 1024 * 1024;
const COVER_MAX_BYTES = 10 * 1024 * 1024;

const LOGO_MAX_W  = 400;
const LOGO_MAX_H  = 400;
const COVER_MAX_W = 1600;
const COVER_MAX_H = 600;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function optimise(buffer: Buffer, slot: 'logo' | 'cover'): Promise<Buffer> {
  const pipeline = sharp(buffer).webp({ quality: 80 });
  if (slot === 'logo') {
    pipeline.resize(LOGO_MAX_W, LOGO_MAX_H, { fit: 'inside', withoutEnlargement: true });
  } else {
    pipeline.resize(COVER_MAX_W, COVER_MAX_H, { fit: 'inside', withoutEnlargement: true });
  }
  return pipeline.toBuffer();
}

function storagePathFromUrl(url: string): string | null {
  try {
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return url.slice(idx + marker.length);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// adminUploadVenueImage
// ---------------------------------------------------------------------------

export async function adminUploadVenueImage(
  formData: FormData,
  locationId: string,
  slot: 'logo' | 'cover',
): Promise<{ url: string } | { error: string }> {
  const { userId } = await requireAdmin();

  const file = formData.get('file');
  if (!(file instanceof File)) return { error: 'No file provided.' };
  if (!ACCEPTED_TYPES.includes(file.type)) return { error: 'Please upload a JPG, PNG, or WebP file.' };

  const maxBytes = slot === 'logo' ? LOGO_MAX_BYTES : COVER_MAX_BYTES;
  const maxLabel = slot === 'logo' ? '5 MB' : '10 MB';
  if (file.size > maxBytes) return { error: `File must be under ${maxLabel}.` };

  const service = createServiceClient();
  const urlColumn = slot === 'logo' ? 'logo_url' : 'cover_image_url';

  const { data: location } = await service
    .from('retailer_locations')
    .select('retailer_id, logo_url, cover_image_url')
    .eq('id', locationId)
    .maybeSingle();

  if (!location) return { error: 'Location not found.' };

  const retailerId = location.retailer_id as string;
  const previousUrl = (location as Record<string, unknown>)[urlColumn] as string | null ?? null;

  let optimisedBuffer: Buffer;
  try {
    const raw = Buffer.from(await file.arrayBuffer());
    optimisedBuffer = await optimise(raw, slot);
  } catch {
    return { error: 'Image processing failed. Please try a different file.' };
  }

  const uuid = crypto.randomUUID().slice(0, 8);
  const storagePath = `${retailerId}/venue-${locationId}-${slot}-${uuid}.webp`;

  const { error: uploadError } = await service.storage
    .from(BUCKET)
    .upload(storagePath, optimisedBuffer, { contentType: 'image/webp', upsert: false });

  if (uploadError) {
    console.error(`[adminUploadVenueImage] storage error (${slot}):`, uploadError.message);
    return { error: 'Upload failed. Please try again.' };
  }

  const { data: { publicUrl } } = service.storage.from(BUCKET).getPublicUrl(storagePath);

  const { error: dbError } = await service
    .from('retailer_locations')
    .update({ [urlColumn]: publicUrl, updated_at: new Date().toISOString() })
    .eq('id', locationId);

  if (dbError) {
    await service.storage.from(BUCKET).remove([storagePath]);
    console.error(`[adminUploadVenueImage] db error (${slot}):`, dbError.message);
    return { error: 'Upload failed. Please try again.' };
  }

  await service.from('admin_actions').insert({
    admin_profile_id: userId,
    action_type:      slot === 'logo' ? 'venue_logo_updated' : 'venue_cover_updated',
    target_table:     'retailer_locations',
    target_id:        locationId,
    reason:           'Uploaded by admin',
    metadata_json:    { retailer_id: retailerId },
  });

  if (previousUrl) {
    const prev = storagePathFromUrl(previousUrl);
    if (prev) await service.storage.from(BUCKET).remove([prev]);
  }

  revalidatePath(`/retailers/${retailerId}`);

  return { url: publicUrl };
}

// ---------------------------------------------------------------------------
// adminRemoveVenueImage
// ---------------------------------------------------------------------------

export async function adminRemoveVenueImage(
  locationId: string,
  slot: 'logo' | 'cover',
): Promise<{ error: string } | null> {
  const { userId } = await requireAdmin();

  const service = createServiceClient();
  const urlColumn = slot === 'logo' ? 'logo_url' : 'cover_image_url';

  const { data: location } = await service
    .from('retailer_locations')
    .select('retailer_id, logo_url, cover_image_url')
    .eq('id', locationId)
    .maybeSingle();

  if (!location) return { error: 'Location not found.' };

  const retailerId = location.retailer_id as string;
  const existingUrl = (location as Record<string, unknown>)[urlColumn] as string | null ?? null;

  // Null the column first — even if Storage deletion later fails, the DB is clean.
  const { error: dbError } = await service
    .from('retailer_locations')
    .update({ [urlColumn]: null, updated_at: new Date().toISOString() })
    .eq('id', locationId);

  if (dbError) {
    console.error(`[adminRemoveVenueImage] db error (${slot}):`, dbError.message);
    return { error: 'Could not remove image. Please try again.' };
  }

  await service.from('admin_actions').insert({
    admin_profile_id: userId,
    action_type:      slot === 'logo' ? 'venue_logo_removed' : 'venue_cover_removed',
    target_table:     'retailer_locations',
    target_id:        locationId,
    reason:           'Removed by admin',
    metadata_json:    { retailer_id: retailerId },
  });

  if (existingUrl) {
    const storagePath = storagePathFromUrl(existingUrl);
    if (storagePath) await service.storage.from(BUCKET).remove([storagePath]);
  }

  revalidatePath(`/retailers/${retailerId}`);

  return null;
}
