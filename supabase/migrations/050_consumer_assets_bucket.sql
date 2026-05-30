-- 050_consumer_assets_bucket.sql
-- Public storage bucket for consumer profile assets (avatars).
-- Files are uploaded directly by the authenticated mobile client.
-- RLS policies restrict writes to the authenticated user's own folder.
--
-- Path convention: consumer-assets/{user_id}/avatar-{timestamp}.{ext}

insert into storage.buckets (id, name, public)
values ('consumer-assets', 'consumer-assets', true);

-- Authenticated users can upload/update files in their own folder only.
create policy "Users can manage their own assets"
  on storage.objects for insert
  with check (
    bucket_id = 'consumer-assets'
    and auth.uid()::text = split_part(name, '/', 1)
  );

create policy "Users can update their own assets"
  on storage.objects for update
  using (
    bucket_id = 'consumer-assets'
    and auth.uid()::text = split_part(name, '/', 1)
  );

create policy "Users can delete their own assets"
  on storage.objects for delete
  using (
    bucket_id = 'consumer-assets'
    and auth.uid()::text = split_part(name, '/', 1)
  );
