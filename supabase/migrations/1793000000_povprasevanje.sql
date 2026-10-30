-- Request mode ("povpraševanje") on the booking page.
--
-- "Podatki podjetij".booking_mode: 'instant' (clients pick a free time, the
-- default) or 'request' (they send a request, the salon picks the time in
-- Rezervacije → Zahteve za termin). Set in Nastavitve rezervacij through
-- /api/company/booking-mode; read by n8n booking-v2 init.
--
-- zahteve_termini: what the client chose on the booking page, so the salon
-- sees it and the confirm sheet starts from it. Filled by n8n booking-v2
-- "Request: Validate" (action request-create).
--
-- Run manually via the Supabase SQL editor. Safe to run twice.

ALTER TABLE "Podatki podjetij" ADD COLUMN IF NOT EXISTS booking_mode text NOT NULL DEFAULT 'instant';
UPDATE "Podatki podjetij" SET booking_mode = 'instant' WHERE booking_mode IS NULL OR booking_mode NOT IN ('instant', 'request');

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'podatki_podjetij_booking_mode_check') THEN
    ALTER TABLE "Podatki podjetij"
      ADD CONSTRAINT podatki_podjetij_booking_mode_check CHECK (booking_mode IN ('instant', 'request'));
  END IF;
END $$;

ALTER TABLE zahteve_termini ADD COLUMN IF NOT EXISTS storitve_ids text[] NOT NULL DEFAULT '{}';
ALTER TABLE zahteve_termini ADD COLUMN IF NOT EXISTS storitve text;
ALTER TABLE zahteve_termini ADD COLUMN IF NOT EXISTS zeljeni_zaposleni_id text;
ALTER TABLE zahteve_termini ADD COLUMN IF NOT EXISTS zeljeni_zaposleni text;
ALTER TABLE zahteve_termini ADD COLUMN IF NOT EXISTS zeljeni_cas text;
ALTER TABLE zahteve_termini ADD COLUMN IF NOT EXISTS privacy_consent boolean;
ALTER TABLE zahteve_termini ADD COLUMN IF NOT EXISTS marketing_consent boolean;

-- Rollback:
--   ALTER TABLE "Podatki podjetij" DROP CONSTRAINT IF EXISTS podatki_podjetij_booking_mode_check;
--   ALTER TABLE zahteve_termini
--     DROP COLUMN IF EXISTS storitve_ids, DROP COLUMN IF EXISTS storitve,
--     DROP COLUMN IF EXISTS zeljeni_zaposleni_id, DROP COLUMN IF EXISTS zeljeni_zaposleni,
--     DROP COLUMN IF EXISTS zeljeni_cas, DROP COLUMN IF EXISTS privacy_consent,
--     DROP COLUMN IF EXISTS marketing_consent;
--   (booking_mode existed before this migration; leave it.)
