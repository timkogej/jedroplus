-- =============================================
-- JEDRO+ ADDON SYSTEM MIGRATION
-- Run in Supabase SQL Editor
-- =============================================

-- 1. Add max_employees to plans table
ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_employees INTEGER DEFAULT 1;

UPDATE plans SET max_employees = 1  WHERE code = 'FREE';
UPDATE plans SET max_employees = 2  WHERE code = 'JEDRO_PLUS';
UPDATE plans SET max_employees = 5  WHERE code = 'JEDRO_PRO';
UPDATE plans SET max_employees = 10 WHERE code = 'JEDRO_PREMIUM';

-- 2. Add addon tracking columns to company_subscriptions
ALTER TABLE company_subscriptions
  ADD COLUMN IF NOT EXISTS sms_addon_monthly          INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_addon_monthly         INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sms_addon_stripe_item_id    TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS email_addon_stripe_item_id  TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sms_addon_cancel_at_period_end    BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_addon_cancel_at_period_end  BOOLEAN DEFAULT FALSE;

-- 3. Add Stripe tracking to company_user_limits
ALTER TABLE company_user_limits
  ADD COLUMN IF NOT EXISTS stripe_subscription_item_id TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end         BOOLEAN DEFAULT FALSE;

-- 4. Sync included_users with plan's max_employees for all active subscriptions
UPDATE company_user_limits cul
SET
  included_users = p.max_employees,
  max_users      = p.max_employees + cul.extra_users,
  updated_at     = NOW()
FROM company_subscriptions cs
JOIN plans p ON p.id = cs.plan_id
WHERE cul.company_id = cs.company_id
  AND cs.status = 'active';

-- Verify:
-- SELECT cul.company_id, cul.included_users, cul.extra_users, cul.max_users, p.code
-- FROM company_user_limits cul
-- JOIN company_subscriptions cs ON cs.company_id = cul.company_id
-- JOIN plans p ON p.id = cs.plan_id
-- WHERE cs.status = 'active';
