-- Receptionist+: languages, recording notice, safe credit top-ups.
--
-- Additive only. Run manually via the Supabase SQL editor.

BEGIN;

-- ── Settings ────────────────────────────────────────────────────────────────
-- language: the receptionist's language ('sl', 'en', 'de', 'hr', 'it').
-- detect_caller_language: switch to the caller's language when it differs.
-- announce_recording / recording_notice_text: say "this call is recorded"
--   before the greeting (empty text = the default for the language, see
--   lib/receptionist.ts). On by default — callers must be told.
ALTER TABLE receptionist_settings ADD COLUMN IF NOT EXISTS detect_caller_language boolean NOT NULL DEFAULT false;
ALTER TABLE receptionist_settings ADD COLUMN IF NOT EXISTS announce_recording boolean NOT NULL DEFAULT true;
ALTER TABLE receptionist_settings ADD COLUMN IF NOT EXISTS recording_notice_text text;

ALTER TABLE receptionist_settings
ADD CONSTRAINT receptionist_language_supported
CHECK (language IN ('sl', 'en', 'de', 'hr', 'it')) NOT VALID;

-- ── Credit purchase in one step ─────────────────────────────────────────────
-- The Stripe webhook used to read the balance, add, and write it back: two
-- deliveries at once (Stripe retries) could both pass the duplicate check,
-- and a call deducting credits in between was overwritten. This does the
-- check, the increment and the log row in one transaction, locked per
-- Checkout session. Returns the new balance, or NULL if already applied.
CREATE OR REPLACE FUNCTION receptionist_add_purchase(
  p_company_slug text,
  p_credits numeric,
  p_checkout_session text,
  p_note text DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_balance numeric;
BEGIN
  IF p_credits IS NULL OR p_credits <= 0 THEN
    RAISE EXCEPTION 'credits must be positive';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('receptionist_purchase:' || p_checkout_session));

  IF EXISTS (
    SELECT 1 FROM receptionist_credit_transactions WHERE stripe_checkout_session = p_checkout_session
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO receptionist_credits (company_slug, balance_credits, updated_at)
  VALUES (p_company_slug, p_credits, now())
  ON CONFLICT (company_slug) DO UPDATE
    SET balance_credits = receptionist_credits.balance_credits + EXCLUDED.balance_credits,
        updated_at = now()
  RETURNING balance_credits INTO new_balance;

  INSERT INTO receptionist_credit_transactions
    (company_slug, delta_credits, balance_after, type, stripe_checkout_session, note)
  VALUES
    (p_company_slug, p_credits, new_balance, 'purchase', p_checkout_session, p_note);

  RETURN new_balance;
END $$;

REVOKE ALL ON FUNCTION receptionist_add_purchase(text, numeric, text, text) FROM PUBLIC, anon, authenticated;

COMMIT;

-- Rollback:
--   DROP FUNCTION IF EXISTS receptionist_add_purchase(text, numeric, text, text);
--   ALTER TABLE receptionist_settings DROP CONSTRAINT IF EXISTS receptionist_language_supported;
--   ALTER TABLE receptionist_settings DROP COLUMN IF EXISTS recording_notice_text;
--   ALTER TABLE receptionist_settings DROP COLUMN IF EXISTS announce_recording;
--   ALTER TABLE receptionist_settings DROP COLUMN IF EXISTS detect_caller_language;
