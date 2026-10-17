-- English version of the custom booking-confirmation SMS template, like the
-- reminders' *_en columns (1790300000). Saved by the app through
-- /api/company/message-templates (BookingSettingsModal → EnglishVariant).
--
-- Read by:
--   - receptionistplus-worker: the SMS after a phone booking in English
--     (agent/sms_client.choose_confirmation_template);
--   - n8n "JEDROPLUS - Vpisovanje podatkov" → "Render SMS iz predloge1",
--     for clients whose language isn't the company's.
--
-- Run manually via the Supabase SQL editor.

ALTER TABLE "Podatki podjetij" ADD COLUMN IF NOT EXISTS lastna_predloga_potrdilo_en text;

-- Rollback:
--   ALTER TABLE "Podatki podjetij" DROP COLUMN IF EXISTS lastna_predloga_potrdilo_en;
