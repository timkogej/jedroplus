-- Photos of services and staff on the booking page.
--
-- "Storitve".slika_url / "Osebe".slika_url: public URL of the photo, or null.
-- Written only by /api/media/entity-image with the service-role key, after the
-- browser has cropped and shrunk the photo. Read by n8n booking-v2 init, which
-- passes it to the booking page.
--
-- booking-images: public bucket (the booking page shows the photos to anyone),
-- one folder per company: <ID Podjetja>/service-<id>-<time>.webp and
-- <ID Podjetja>/staff-<id>-<time>.webp. No upload policies: only the server
-- writes, with the service-role key.
--
-- Run manually via the Supabase SQL editor. Safe to run twice.

ALTER TABLE "Storitve" ADD COLUMN IF NOT EXISTS slika_url text;
ALTER TABLE "Osebe" ADD COLUMN IF NOT EXISTS slika_url text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('booking-images', 'booking-images', true, 2097152, ARRAY['image/webp', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
