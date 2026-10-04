-- Company region: country, time zone and currency on "Podatki podjetij".
--
-- Additive only. Run manually via the Supabase SQL editor. The app already
-- works without it (lib/region.ts falls back to the legacy country name, then
-- Slovenia), so it can run before or after the deploy.
--
--   country_code  ISO 3166-1 alpha-2 ('SI', 'HR', 'DE', …)
--   timezone      IANA zone ('Europe/Ljubljana') — appointments' "Datum" and
--                 "Čas" are wall-clock times in this zone
--   valuta        ISO 4217 ('EUR') — already read by Storitve; created here
--                 if it does not exist yet
--
-- Written by the app through /api/company/region (service role, owner/admin),
-- which also validates the time zone (a CHECK cannot look it up).
-- n8n should read timezone when it decides when a reminder is due.

ALTER TABLE "Podatki podjetij"
ADD COLUMN IF NOT EXISTS country_code text NOT NULL DEFAULT 'SI';

ALTER TABLE "Podatki podjetij"
ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Europe/Ljubljana';

ALTER TABLE "Podatki podjetij"
ADD COLUMN IF NOT EXISTS valuta text;

UPDATE "Podatki podjetij" SET valuta = 'EUR' WHERE valuta IS NULL OR btrim(valuta) = '';

ALTER TABLE "Podatki podjetij" ALTER COLUMN valuta SET DEFAULT 'EUR';

ALTER TABLE "Podatki podjetij"
ADD CONSTRAINT country_code_format CHECK (country_code ~ '^[A-Z]{2}$');

-- Backfill from the English country name onboarding sent to n8n, where a
-- column holding it exists (checked, because it is not in this repo's schema).
DO $$
DECLARE
  src text;
BEGIN
  SELECT quote_ident(column_name) INTO src
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'Podatki podjetij'
     AND column_name IN ('country', 'Country', 'Država', 'drzava')
   LIMIT 1;

  IF src IS NULL THEN
    RETURN;
  END IF;

  EXECUTE format($f$
    UPDATE "Podatki podjetij" p
       SET country_code = m.code,
           timezone     = m.tz
      FROM (VALUES
        ('Slovenia','SI','Europe/Ljubljana'), ('Croatia','HR','Europe/Zagreb'),
        ('Serbia','RS','Europe/Belgrade'), ('Bosnia and Herzegovina','BA','Europe/Sarajevo'),
        ('Montenegro','ME','Europe/Podgorica'), ('North Macedonia','MK','Europe/Skopje'),
        ('Austria','AT','Europe/Vienna'), ('Germany','DE','Europe/Berlin'),
        ('Italy','IT','Europe/Rome'), ('Hungary','HU','Europe/Budapest'),
        ('Czech Republic','CZ','Europe/Prague'), ('Slovakia','SK','Europe/Bratislava'),
        ('Poland','PL','Europe/Warsaw'), ('Romania','RO','Europe/Bucharest'),
        ('Bulgaria','BG','Europe/Sofia'), ('France','FR','Europe/Paris'),
        ('Spain','ES','Europe/Madrid'), ('Portugal','PT','Europe/Lisbon'),
        ('Netherlands','NL','Europe/Amsterdam'), ('Belgium','BE','Europe/Brussels'),
        ('Switzerland','CH','Europe/Zurich'), ('United Kingdom','GB','Europe/London'),
        ('United States','US','America/New_York'), ('Canada','CA','America/Toronto'),
        ('Australia','AU','Australia/Sydney')
      ) AS m(name, code, tz)
     WHERE p.%s = m.name
  $f$, src);
END $$;

-- Check afterwards:
--   SELECT country_code, timezone, valuta, count(*) FROM "Podatki podjetij" GROUP BY 1, 2, 3;
--
-- Rollback (valuta is left in place — Storitve read it before this migration):
--   ALTER TABLE "Podatki podjetij" DROP CONSTRAINT IF EXISTS country_code_format;
--   ALTER TABLE "Podatki podjetij" DROP COLUMN IF EXISTS timezone;
--   ALTER TABLE "Podatki podjetij" DROP COLUMN IF EXISTS country_code;
