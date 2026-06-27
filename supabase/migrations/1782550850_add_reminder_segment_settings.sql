-- Add reminder & client-segment settings columns.
-- Additive only (ALTER TABLE ... ADD COLUMN). Run manually via Supabase SQL editor.
-- Existing rows stay valid via sensible defaults.

-- "Podatki podjetij": reminder settings (Opomniki page)
ALTER TABLE "Podatki podjetij"
ADD COLUMN IF NOT EXISTS "nagovor" text NOT NULL DEFAULT 'vikanje';

ALTER TABLE "Podatki podjetij"
ADD CONSTRAINT nagovor_allowed CHECK ("nagovor" IN ('vikanje', 'tikanje'));

ALTER TABLE "Podatki podjetij"
ADD COLUMN IF NOT EXISTS "samodejni_opomnik" boolean NOT NULL DEFAULT false;

ALTER TABLE "Podatki podjetij"
ADD COLUMN IF NOT EXISTS "sms_oseba_pred" boolean NOT NULL DEFAULT false;

ALTER TABLE "Podatki podjetij"
ADD COLUMN IF NOT EXISTS "dni_prej" integer NOT NULL DEFAULT 1;

ALTER TABLE "Podatki podjetij"
ADD CONSTRAINT dni_prej_range CHECK ("dni_prej" BETWEEN 1 AND 7);

-- "Stranke": client segment (Stranke page). Column name has a space and capital T.
ALTER TABLE "Stranke"
ADD COLUMN IF NOT EXISTS "Tip stranke" text NOT NULL DEFAULT 'nova';

ALTER TABLE "Stranke"
ADD CONSTRAINT tip_stranke_allowed CHECK ("Tip stranke" IN ('nova', 'redna', 'vip'));
