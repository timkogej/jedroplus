-- Customer portal profile and announcement email eligibility use this timestamp.
-- Existing installations may already have it; keep the migration repeatable.
alter table public."Stranke"
  add column if not exists marketing_opt_out_at timestamptz;
