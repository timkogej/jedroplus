-- Free reminder trial: 20 SMS + 100 email reminders per FREE company, ONCE.
--
-- Why overrides and not plans.FREE quotas: usage rows (company_sms_usage /
-- company_email_usage) are monthly even for FREE (period_start → +1 month),
-- so a plan quota would refill every month. n8n's quota check already uses
--   total = COALESCE(cs.*_quota_override, plan quota + add-ons)
-- against the current period's sent_count. We keep the override at
--   trial − (everything sent in earlier periods)
-- so this period's allowance is exactly what is left of the trial.
--
-- Also enables SMS for JEDRO_PLUS (0 included; purchased SMS add-ons only),
-- matching what the app shows since Sklop 0.

BEGIN;

-- ── Channels ────────────────────────────────────────────────────────────────
UPDATE plans SET sms_enabled = TRUE, email_enabled = TRUE WHERE code = 'FREE';
UPDATE plans SET sms_enabled = TRUE WHERE code = 'JEDRO_PLUS';

-- ── Helper: what is left of the trial before a given period ─────────────────
CREATE OR REPLACE FUNCTION free_trial_remaining(p_company uuid, p_channel text, p_before date)
RETURNS integer
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  trial integer := CASE WHEN p_channel = 'sms' THEN 20 ELSE 100 END;
  used_before integer;
BEGIN
  IF p_channel = 'sms' THEN
    SELECT COALESCE(SUM(sent_count), 0) INTO used_before
      FROM company_sms_usage
     WHERE company_id = p_company AND (p_before IS NULL OR period_start < p_before);
  ELSE
    SELECT COALESCE(SUM(sent_count), 0) INTO used_before
      FROM company_email_usage
     WHERE company_id = p_company AND (p_before IS NULL OR period_start < p_before);
  END IF;
  RETURN GREATEST(0, trial - used_before);
END $$;

CREATE OR REPLACE FUNCTION is_free_company(p_company uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM company_subscriptions cs JOIN plans p ON p.id = cs.plan_id
     WHERE cs.company_id = p_company AND cs.status = 'active' AND p.code = 'FREE'
  );
$$;

-- ── New monthly period for a FREE company → set this period's allowance ─────
CREATE OR REPLACE FUNCTION free_trial_on_new_period()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_free_company(NEW.company_id) THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'company_sms_usage' THEN
    UPDATE company_subscriptions
       SET sms_quota_override = free_trial_remaining(NEW.company_id, 'sms', NEW.period_start)
     WHERE company_id = NEW.company_id AND status = 'active';
  ELSE
    UPDATE company_subscriptions
       SET email_quota_override = free_trial_remaining(NEW.company_id, 'email', NEW.period_start)
     WHERE company_id = NEW.company_id AND status = 'active';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_free_trial_sms_period ON company_sms_usage;
CREATE TRIGGER trg_free_trial_sms_period
  AFTER INSERT ON company_sms_usage
  FOR EACH ROW EXECUTE FUNCTION free_trial_on_new_period();

DROP TRIGGER IF EXISTS trg_free_trial_email_period ON company_email_usage;
CREATE TRIGGER trg_free_trial_email_period
  AFTER INSERT ON company_email_usage
  FOR EACH ROW EXECUTE FUNCTION free_trial_on_new_period();

-- ── New FREE subscription → start with the full (remaining) trial ───────────
-- ── Upgrade away from FREE → drop the trial overrides so plan quotas apply ──
CREATE OR REPLACE FUNCTION free_trial_on_subscription()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_code text;
  old_code text;
BEGIN
  SELECT code INTO new_code FROM plans WHERE id = NEW.plan_id;

  IF TG_OP = 'INSERT' THEN
    IF new_code = 'FREE' THEN
      NEW.sms_quota_override := COALESCE(NEW.sms_quota_override, free_trial_remaining(NEW.company_id, 'sms', NULL));
      NEW.email_quota_override := COALESCE(NEW.email_quota_override, free_trial_remaining(NEW.company_id, 'email', NULL));
    END IF;
    RETURN NEW;
  END IF;

  SELECT code INTO old_code FROM plans WHERE id = OLD.plan_id;
  IF old_code = 'FREE' AND new_code IS DISTINCT FROM 'FREE' THEN
    NEW.sms_quota_override := NULL;
    NEW.email_quota_override := NULL;
  ELSIF old_code IS DISTINCT FROM 'FREE' AND new_code = 'FREE' THEN
    -- Downgrade back to FREE: only what's left of the one-time trial.
    NEW.sms_quota_override := free_trial_remaining(NEW.company_id, 'sms', NULL);
    NEW.email_quota_override := free_trial_remaining(NEW.company_id, 'email', NULL);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_free_trial_subscription ON company_subscriptions;
CREATE TRIGGER trg_free_trial_subscription
  BEFORE INSERT OR UPDATE OF plan_id ON company_subscriptions
  FOR EACH ROW EXECUTE FUNCTION free_trial_on_subscription();

-- ── Backfill existing FREE companies ────────────────────────────────────────
-- Allowance for the current period = trial − everything sent before it.
UPDATE company_subscriptions cs
   SET sms_quota_override = free_trial_remaining(
         cs.company_id, 'sms',
         (SELECT MAX(u.period_start) FROM company_sms_usage u WHERE u.company_id = cs.company_id)),
       email_quota_override = free_trial_remaining(
         cs.company_id, 'email',
         (SELECT MAX(u.period_start) FROM company_email_usage u WHERE u.company_id = cs.company_id))
  FROM plans p
 WHERE p.id = cs.plan_id AND p.code = 'FREE' AND cs.status = 'active';

COMMIT;

-- Check afterwards (should show 20 / 100 for fresh FREE accounts):
--   SELECT cs.company_id, cs.sms_quota_override, cs.email_quota_override
--   FROM company_subscriptions cs JOIN plans p ON p.id = cs.plan_id
--   WHERE p.code = 'FREE' AND cs.status = 'active' LIMIT 10;
--
-- Rollback:
--   DROP TRIGGER IF EXISTS trg_free_trial_sms_period ON company_sms_usage;
--   DROP TRIGGER IF EXISTS trg_free_trial_email_period ON company_email_usage;
--   DROP TRIGGER IF EXISTS trg_free_trial_subscription ON company_subscriptions;
--   UPDATE company_subscriptions cs SET sms_quota_override = NULL, email_quota_override = NULL
--     FROM plans p WHERE p.id = cs.plan_id AND p.code = 'FREE';
--   UPDATE plans SET sms_enabled = FALSE WHERE code IN ('FREE', 'JEDRO_PLUS');
