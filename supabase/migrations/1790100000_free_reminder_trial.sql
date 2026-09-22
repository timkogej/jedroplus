-- Free reminder trial: 20 SMS + 100 email reminders for FREE accounts.
--
-- n8n's quota check reads plans.sms_quota_monthly / email_quota_monthly for the
-- company's active subscription and compares them with the usage row for the
-- current period (company_sms_usage / company_email_usage). FREE accounts have
-- an active subscription whose period runs ~50 years, so — IF the usage rows
-- follow the subscription period — these numbers act as a one-time trial.
-- Run the checks in section 1 first and confirm that before running section 2.
--
-- The app (Opomniki page, sidebar, reminder editor, quota banner) unlocks for
-- FREE automatically once these quotas are > 0; nothing else needs deploying.

-- ── 1. Checks (read-only) ───────────────────────────────────────────────────
-- a) Current plan settings:
--   SELECT code, sms_enabled, email_enabled, sms_quota_monthly, email_quota_monthly
--   FROM plans ORDER BY code;
--
-- b) A FREE company's subscription period (TEST Sklop1 Salon):
--   SELECT cs.status, cs.current_period_start, cs.current_period_end, p.code
--   FROM company_subscriptions cs JOIN plans p ON p.id = cs.plan_id
--   WHERE cs.company_id = 'b1475d73-8042-4182-a653-83795984c3ed';
--
-- c) How usage periods look for FREE vs paid companies:
--   SELECT u.company_id, p.code, u.period_start, u.period_end, u.sent_count
--   FROM company_email_usage u
--   JOIN company_subscriptions cs ON cs.company_id = u.company_id AND cs.status = 'active'
--   JOIN plans p ON p.id = cs.plan_id
--   ORDER BY u.created_at DESC LIMIT 20;
--
-- If FREE usage rows are MONTHLY (period_end ~1 month after period_start), the
-- trial would refill every month — tell Claude before running section 2.

-- ── 2. Enable the trial ─────────────────────────────────────────────────────
UPDATE plans
SET sms_enabled = TRUE,
    email_enabled = TRUE,
    sms_quota_monthly = 20,
    email_quota_monthly = 100
WHERE code = 'FREE';

-- Rollback (restore the values you saw in check 1a), e.g.:
--   UPDATE plans SET sms_enabled = FALSE, email_enabled = FALSE,
--     sms_quota_monthly = 0, email_quota_monthly = 0 WHERE code = 'FREE';
