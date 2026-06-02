'use server';

import sharp from 'sharp';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

const BUCKET = 'retailer-assets';
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024;
const OUT_W = 1200;
const OUT_H = 675;

export type OfferImageResult =
  | { url: string }
  | { error: string };

export async function uploadOfferImage(formData: FormData): Promise<OfferImageResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated.' };

  const service = createServiceClient();
  const { data: ru } = await service
    .from('retailer_users')
    .select('retailer_id')
    .eq('profile_id', user.id)
    .maybeSingle();
  if (!ru) return { error: 'No retailer account.' };

  const file = formData.get('file') as File | null;
  if (!file) return { error: 'No file provided.' };
  if (!ACCEPTED_TYPES.includes(file.type)) return { error: 'Please upload a JPG, PNG, or WebP image.' };
  if (file.size > MAX_BYTES) return { error: 'Image must be under 10 MB.' };

  const buffer = Buffer.from(await file.arrayBuffer());
  const optimised = await sharp(buffer)
    .resize(OUT_W, OUT_H, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  const path = `${ru.retailer_id}/offers/cover-${Date.now()}.webp`;

  const { error: upErr } = await service.storage
    .from(BUCKET)
    .upload(path, optimised, {
      contentType: 'image/webp',
      upsert: true,
    });

  if (upErr) {
    console.error('[uploadOfferImage] storage error:', upErr.message);
    return { error: 'Upload failed. Please try again.' };
  }

  const { data: urlData } = service.storage.from(BUCKET).getPublicUrl(path);
  return { url: urlData.publicUrl };
}
