-- Own template for the booking-confirmation EMAIL, like the SMS one
-- (sms_type_potrdilo / lastna_predloga_potrdilo / lastna_predloga_potrdilo_en).
-- Until now the email was always written by OpenAI ("Ustvari potrdilo").
--
-- email_type_potrdilo: 'AI' (default, as before) or 'LP' (own template).
-- Subject and body in the company's language, plus an optional English
-- version for clients whose language isn't the company's.
--
-- Saved by the app through /api/company/message-templates
-- (BookingSettingsModal → EmailConfirmationTemplate).
--
-- Read by n8n, node "Email predloga - potrdilo", in:
--   - "Jedroplus Booking v2" (online bookings);
--   - "JEDROPLUS - Vpisovanje podatkov" (appointments entered in Jedro+).
--
-- Run manually via the Supabase SQL editor.

ALTER TABLE "Podatki podjetij" ADD COLUMN IF NOT EXISTS email_type_potrdilo text NOT NULL DEFAULT 'AI';
ALTER TABLE "Podatki podjetij" ADD COLUMN IF NOT EXISTS email_zadeva_potrdilo text;
ALTER TABLE "Podatki podjetij" ADD COLUMN IF NOT EXISTS email_predloga_potrdilo text;
ALTER TABLE "Podatki podjetij" ADD COLUMN IF NOT EXISTS email_zadeva_potrdilo_en text;
ALTER TABLE "Podatki podjetij" ADD COLUMN IF NOT EXISTS email_predloga_potrdilo_en text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'podatki_podjetij_email_type_potrdilo_check'
  ) THEN
    ALTER TABLE "Podatki podjetij"
      ADD CONSTRAINT podatki_podjetij_email_type_potrdilo_check
      CHECK (email_type_potrdilo IN ('AI', 'LP'));
  END IF;
END $$;

-- Rollback:
--   ALTER TABLE "Podatki podjetij" DROP CONSTRAINT IF EXISTS podatki_podjetij_email_type_potrdilo_check;
--   ALTER TABLE "Podatki podjetij"
--     DROP COLUMN IF EXISTS email_type_potrdilo,
--     DROP COLUMN IF EXISTS email_zadeva_potrdilo,
--     DROP COLUMN IF EXISTS email_predloga_potrdilo,
--     DROP COLUMN IF EXISTS email_zadeva_potrdilo_en,
--     DROP COLUMN IF EXISTS email_predloga_potrdilo_en;
