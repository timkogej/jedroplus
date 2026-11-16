-- Customer portal sessions (portal.jedroplus.com).
--
-- Until now the portal's n8n flows (appointments, cancel, reschedule slots,
-- reschedule confirm) trusted company_slug + email alone, so anyone who
-- knew a customer's email could list or cancel their appointments. Now the
-- verify flow ("Customer portal – Verify login token") issues a session
-- token after the emailed login link is used, the portal sends it with
-- every call, and the flows check it with portal_session_check().
--
-- Run manually via the Supabase SQL editor, before the n8n changes.

create table if not exists public.customer_portal_sessions (
  token          text primary key,
  company_slug   text not null,
  customer_email text not null,
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null
);
create index if not exists customer_portal_sessions_expires_idx
  on public.customer_portal_sessions (expires_at);
alter table public.customer_portal_sessions enable row level security;
-- No policies: written by n8n with the service role only.

-- Called by the n8n flows with the public anon key: says only whether a
-- token is a live session for this company and email, never reveals rows.
create or replace function public.portal_session_check(p_token text, p_slug text, p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.customer_portal_sessions
    where token = p_token
      and company_slug = p_slug
      and lower(customer_email) = lower(p_email)
      and expires_at > now()
  );
$$;

revoke all on function public.portal_session_check(text, text, text) from public;
grant execute on function public.portal_session_check(text, text, text) to anon, authenticated, service_role;

-- Rollback:
--   drop function if exists public.portal_session_check(text, text, text);
--   drop table if exists public.customer_portal_sessions;
