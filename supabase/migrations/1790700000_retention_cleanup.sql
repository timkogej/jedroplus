-- Retention promised in the privacy policy and the data processing agreement
-- (lib/legal): call transcripts 90 days, SMS log 12 months.
--
-- Run manually via the Supabase SQL editor, after 1790400000 (sms_log).
-- Uses pg_cron (Supabase: Database → Extensions → pg_cron) to run nightly.
-- Recordings stored outside Supabase (Telnyx / ElevenLabs / Soniox) are not
-- covered here — set their retention in those dashboards.

CREATE OR REPLACE FUNCTION purge_expired_data()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Receptionist+: keep the call (time, duration, credits, outcome) for
  -- billing, drop what was said.
  IF to_regclass('public.receptionist_calls') IS NOT NULL THEN
    UPDATE receptionist_calls
       SET transcript = NULL
     WHERE transcript IS NOT NULL
       AND started_at < now() - interval '90 days';
  END IF;

  IF to_regclass('public.sms_log') IS NOT NULL THEN
    DELETE FROM sms_log WHERE created_at < now() - interval '12 months';
  END IF;
END $$;

REVOKE ALL ON FUNCTION purge_expired_data() FROM PUBLIC;

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'jedroplus-retention';
  PERFORM cron.schedule('jedroplus-retention', '15 3 * * *', 'SELECT purge_expired_data()');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not available (%). Enable it and re-run this block, or call purge_expired_data() daily from n8n.', SQLERRM;
END $$;

-- Run once now:
--   SELECT purge_expired_data();
--
-- Rollback:
--   SELECT cron.unschedule('jedroplus-retention');
--   DROP FUNCTION IF EXISTS purge_expired_data();
