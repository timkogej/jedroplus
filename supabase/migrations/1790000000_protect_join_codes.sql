-- Protect companies.join_code_admin / join_code_staff from browser clients.
--
-- The join codes grant access to a company (the admin code grants full admin
-- access). They were readable by any client that can SELECT from companies,
-- including staff members. The core app now reads them only through
-- /api/company/join-codes (service role + owner/admin check), so browser
-- clients (anon, authenticated) no longer need these two columns.
--
-- Postgres cannot revoke a single column while a table-wide SELECT grant
-- exists, so we revoke the table-wide grant and re-grant every OTHER column.
-- The service role and n8n (service role) are unaffected.
--
-- BEFORE RUNNING: other Jedroplus apps (booking, register, POS, chatbot) that
-- run `select('*')` on companies with the anon/authenticated key would start
-- failing. Check them first. Rollback is at the bottom.

REVOKE SELECT ON public.companies FROM anon, authenticated;

DO $$
DECLARE
  cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'companies'
     AND column_name NOT IN ('join_code_admin', 'join_code_staff');

  EXECUTE format('GRANT SELECT (%s) ON public.companies TO anon, authenticated', cols);
END $$;

-- Note: a column added to companies later is NOT readable by browser clients
-- until it is granted explicitly, e.g.:
--   GRANT SELECT (new_column) ON public.companies TO anon, authenticated;

-- Rollback:
--   GRANT SELECT ON public.companies TO anon, authenticated;
