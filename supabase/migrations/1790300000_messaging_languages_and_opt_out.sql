-- Messaging, phase 1: English template variants and marketing opt-out.
--
-- Additive only. Run manually via the Supabase SQL editor. The app works
-- without it (English variants just can't be saved; nobody is filtered out).

-- ── English variants of the custom templates ────────────────────────────────
-- Sent to clients whose language differs from the company's, when set
-- (rule lives in n8n — see docs/multi-country-todo.md). Empty = use the
-- normal template, as before. Written by /api/company/message-templates.
ALTER TABLE "Podatki podjetij" ADD COLUMN IF NOT EXISTS lastna_predloga_pred_en text;
ALTER TABLE "Podatki podjetij" ADD COLUMN IF NOT EXISTS lastna_predloga_po_en text;
ALTER TABLE "Podatki podjetij" ADD COLUMN IF NOT EXISTS obvestilo_prestavitev_template_sms_en text;
ALTER TABLE "Podatki podjetij" ADD COLUMN IF NOT EXISTS obvestilo_prestavitev_template_email_en text;

-- ── Marketing consent / opt-out on clients ──────────────────────────────────
-- marketing_consent: true/false when the client said so (public registration
--   form), NULL for everyone else (existing clients: may receive marketing
--   until they opt out — the "existing customer" exception).
-- marketing_opt_out_at: set when the client clicks the unsubscribe link.
-- Marketing (Komunikacija) skips a client when marketing_consent = false or
-- marketing_opt_out_at IS NOT NULL. Reminders are service messages and are
-- not affected.
ALTER TABLE "Stranke" ADD COLUMN IF NOT EXISTS marketing_consent boolean;
ALTER TABLE "Stranke" ADD COLUMN IF NOT EXISTS marketing_opt_out_at timestamptz;

-- Rollback:
--   ALTER TABLE "Stranke" DROP COLUMN IF EXISTS marketing_opt_out_at;
--   ALTER TABLE "Stranke" DROP COLUMN IF EXISTS marketing_consent;   -- only if this migration created it
--   ALTER TABLE "Podatki podjetij" DROP COLUMN IF EXISTS obvestilo_prestavitev_template_email_en;
--   ALTER TABLE "Podatki podjetij" DROP COLUMN IF EXISTS obvestilo_prestavitev_template_sms_en;
--   ALTER TABLE "Podatki podjetij" DROP COLUMN IF EXISTS lastna_predloga_po_en;
--   ALTER TABLE "Podatki podjetij" DROP COLUMN IF EXISTS lastna_predloga_pred_en;
