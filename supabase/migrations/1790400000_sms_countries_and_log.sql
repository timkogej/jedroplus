-- SMS by country + SMS log with delivery status (BulkGate).
--
-- Additive only. Run manually via the Supabase SQL editor.
--
-- 1. sms_countries / sms_allowed(): where SMS may go. Packages cost the same
--    everywhere, so SMS only go to countries priced like Slovenia; other
--    numbers get email. n8n calls sms_allowed() before every SMS.
--    Keep in sync with lib/sms.ts (SMS_COUNTRIES).
-- 2. sms_log: one row per SMS n8n sends, updated by BulkGate's delivery
--    report. The app shows the latest rows on the Opomniki page.

BEGIN;

-- ── 1. Countries ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sms_countries (
  country_code text PRIMARY KEY CHECK (country_code ~ '^[A-Z]{2}$'),
  dial_code    text NOT NULL UNIQUE CHECK (dial_code ~ '^\+[0-9]{1,4}$'),
  enabled      boolean NOT NULL DEFAULT true
);

INSERT INTO sms_countries (country_code, dial_code) VALUES
  ('SI', '+386'), ('HR', '+385'), ('AT', '+43'), ('DE', '+49'), ('IT', '+39')
ON CONFLICT (country_code) DO NOTHING;

ALTER TABLE sms_countries ENABLE ROW LEVEL SECURITY;

-- True when an SMS may go to `phone`. Numbers without a country code
-- ("040 123 456") belong to the company's country.
CREATE OR REPLACE FUNCTION sms_allowed(phone text, company_country text DEFAULT 'SI')
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH n AS (
    SELECT regexp_replace(regexp_replace(coalesce(phone, ''), '[^0-9+]', '', 'g'), '^00', '+') AS p
  )
  SELECT CASE
    WHEN (SELECT p FROM n) = '' THEN false
    WHEN (SELECT p FROM n) LIKE '+%' THEN EXISTS (
      SELECT 1 FROM sms_countries c
       WHERE c.enabled AND (SELECT p FROM n) LIKE c.dial_code || '%'
    )
    ELSE EXISTS (
      SELECT 1 FROM sms_countries c
       WHERE c.enabled AND c.country_code = upper(coalesce(company_country, 'SI'))
    )
  END;
$$;

-- ── 2. Log ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sms_log (
  id              bigserial PRIMARY KEY,
  company_id      text NOT NULL,              -- "ID Podjetja" (text business id)
  client_id       bigint,                     -- "Stranke".id, when known
  termin_id       text,                       -- appointment, when known
  phone           text NOT NULL,
  kind            text NOT NULL DEFAULT 'other'
                  CHECK (kind IN ('reminder_before', 'reminder_after', 'reschedule', 'confirmation', 'marketing', 'other')),
  status          text NOT NULL DEFAULT 'sent'
                  CHECK (status IN ('sent', 'delivered', 'failed', 'blocked_country')),
  error           text,
  bulkgate_sms_id text UNIQUE,                -- to match BulkGate's delivery report
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sms_log_company_created ON sms_log (company_id, created_at DESC);

-- Only the service role (n8n, the app's API routes) reads and writes it.
ALTER TABLE sms_log ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Check afterwards:
--   SELECT sms_allowed('+38640123456'), sms_allowed('+4915123456789'),
--          sms_allowed('+33612345678'), sms_allowed('040 123 456', 'SI');
--   → true, true, false, true
--
-- Open another country later:
--   INSERT INTO sms_countries (country_code, dial_code) VALUES ('SK', '+421');
--   (and add 'SK' to SMS_COUNTRIES in lib/sms.ts)
--
-- Rollback:
--   DROP TABLE IF EXISTS sms_log;
--   DROP FUNCTION IF EXISTS sms_allowed(text, text);
--   DROP TABLE IF EXISTS sms_countries;
