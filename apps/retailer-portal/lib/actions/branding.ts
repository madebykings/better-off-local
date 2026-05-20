'use server';

import sharp from 'sharp';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BUCKET = 'retailer-assets';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const LOGO_MAX_BYTES  = 5 * 1024 * 1024;  // 5 MB raw upload limit
const COVER_MAX_BYTES = 10 * 1024 * 1024; // 10 MB raw upload limit

// Optimised output dimensions
const LOGO_MAX_W  = 400;
const LOGO_MAX_H  = 400;
const COVER_MAX_W = 1600;
const COVER_MAX_H = 600;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getAuthUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

async function getRetailerId(userId: string): Promise<string | null> {
  const service = createServiceClient();
  const { data } = await service
    .from('retailer_users')
    .select('retailer_id')
    .eq('profile_id', userId)
    .maybeSingle();
  return data?.retailer_id ?? null;
}

/**
 * Extracts the storage object path from a Supabase public URL.
 * Input:  https://<project>.supabase.co/storage/v1/object/public/retailer-assets/abc/logo-xyz.webp
 * Output: abc/logo-xyz.webp
 */
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

async function optimise(
  buffer: Buffer,
  slot: 'logo' | 'cover',
): Promise<Buffer> {
  const pipeline = sharp(buffer).webp({ quality: 80 });
  if (slot === 'logo') {
    pipeline.resize(LOGO_MAX_W, LOGO_MAX_H, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  } else {
    pipeline.resize(COVER_MAX_W, COVER_MAX_H, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }
  return pipeline.toBuffer();
}

// ---------------------------------------------------------------------------
// uploadRetailerImage
// ---------------------------------------------------------------------------

/**
 * Accepts a file from a multipart form upload, optimises it (resize + WebP),
 * uploads to Supabase Storage, updates the retailer record, then deletes the
 * previous file (if one existed).
 *
 * Upload order:
 *   1. Optimise
 *   2. Upload new file to Storage
 *   3. Update retailers.logo_url / cover_image_url
 *   4. Delete previous file from Storage (after DB is committed)
 *
 * The previous file is deleted last so a Storage or DB failure at any earlier
 * step leaves the old image intact rather than leaving the retailer with no image.
 */
export async function uploadRetailerImage(
  formData: FormData,
  slot: 'logo' | 'cover',
): Promise<{ url: string } | { error: string }> {
  const userId = await getAuthUserId();
  if (!userId) return { error: 'Not authenticated.' };

  const retailerId = await getRetailerId(userId);
  if (!retailerId) return { error: 'Please complete step 1 before uploading images.' };

  // ── Validate file ────────────────────────────────────────────────────────
  const file = formData.get('file');
  if (!(file instanceof File)) return { error: 'No file provided.' };

  if (!ACCEPTED_TYPES.includes(file.type)) {
    return { error: 'Please upload a JPG, PNG, or WebP file.' };
  }

  const maxBytes = slot === 'logo' ? LOGO_MAX_BYTES : COVER_MAX_BYTES;
  const maxLabel = slot === 'logo' ? '5 MB' : '10 MB';
  if (file.size > maxBytes) {
    return { error: `File must be under ${maxLabel}.` };
  }

  // ── Read current URL (for deferred deletion) ─────────────────────────────
  const service = createServiceClient();
  const urlColumn = slot === 'logo' ? 'logo_url' : 'cover_image_url';

  const { data: current } = await service
    .from('retailers')
    .select(urlColumn)
    .eq('id', retailerId)
    .single();

  const previousUrl: string | null = current?.[urlColumn] ?? null;

  // ── Optimise ─────────────────────────────────────────────────────────────
  let optimisedBuffer: Buffer;
  try {
    const raw = Buffer.from(await file.arrayBuffer());
    optimisedBuffer = await optimise(raw, slot);
  } catch {
    return { error: 'Image processing failed. Please try a different file.' };
  }

  // ── Upload to Storage ────────────────────────────────────────────────────
  const uuid = crypto.randomUUID().slice(0, 8);
  const storagePath = `${retailerId}/${slot}-${uuid}.webp`;

  const { error: uploadError } = await service.storage
    .from(BUCKET)
    .upload(storagePath, optimisedBuffer, {
      contentType: 'image/webp',
      upsert: false,
    });

  if (uploadError) {
    console.error(`[uploadRetailerImage] storage upload error (${slot}):`, uploadError.message);
    return { error: 'Upload failed. Please try again.' };
  }

  // ── Get public URL ────────────────────────────────────────────────────────
  const { data: { publicUrl } } = service.storage
    .from(BUCKET)
    .getPublicUrl(storagePath);

  // ── Update retailer row ───────────────────────────────────────────────────
  const { error: dbError } = await service
    .from('retailers')
    .update({
      [urlColumn]: publicUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', retailerId);

  if (dbError) {
    // DB update failed — remove the just-uploaded file so storage is not orphaned.
    await service.storage.from(BUCKET).remove([storagePath]);
    console.error(`[uploadRetailerImage] db update error (${slot}):`, dbError.message);
    return { error: 'Upload failed. Please try again.' };
  }

  // ── Delete previous file (after DB is committed) ──────────────────────────
  if (previousUrl) {
    const previousPath = storagePathFromUrl(previousUrl);
    if (previousPath) {
      await service.storage.from(BUCKET).remove([previousPath]);
      // Deletion failure is non-fatal — a background cleanup job can handle orphans.
    }
  }

  return { url: publicUrl };
}

// ---------------------------------------------------------------------------
// removeRetailerImage
// ---------------------------------------------------------------------------

/**
 * Clears the logo or cover image: deletes the file from Storage and nulls the
 * corresponding column on the retailers row.
 */
export async function removeRetailerImage(
  slot: 'logo' | 'cover',
): Promise<{ error: string } | null> {
  const userId = await getAuthUserId();
  if (!userId) return { error: 'Not authenticated.' };

  const retailerId = await getRetailerId(userId);
  if (!retailerId) return { error: 'No retailer record found.' };

  const service = createServiceClient();
  const urlColumn = slot === 'logo' ? 'logo_url' : 'cover_image_url';

  const { data: current } = await service
    .from('retailers')
    .select(urlColumn)
    .eq('id', retailerId)
    .single();

  const existingUrl: string | null = current?.[urlColumn] ?? null;

  // Null the column first — even if Storage deletion fails, the DB is clean.
  const { error: dbError } = await service
    .from('retailers')
    .update({
      [urlColumn]: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', retailerId);

  if (dbError) {
    console.error(`[removeRetailerImage] db update error (${slot}):`, dbError.message);
    return { error: 'Could not remove image. Please try again.' };
  }

  // Delete from Storage after DB is committed.
  if (existingUrl) {
    const storagePath = storagePathFromUrl(existingUrl);
    if (storagePath) {
      await service.storage.from(BUCKET).remove([storagePath]);
    }
  }

  return null;
}
