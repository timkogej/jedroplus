-- Minimalni nadomestki za Supabase, da lahko migracijo glasovnega asistenta
-- preizkusimo v čistem Postgresu (Docker). Ni produkcijska shema.
create extension if not exists pgcrypto;
do $$ begin
  create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin
  create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin
  create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

create table public.companies (id uuid primary key, company_id text unique not null);
create table public.company_members (company_id uuid, user_id uuid, role text, person_id bigint);
create table public.staff_role_permissions (
  company_id uuid primary key,
  can_access_asistent_plus boolean not null default false,
  can_view_clients boolean not null default true,
  can_edit_clients boolean not null default true,
  can_create_clients boolean not null default true,
  can_view_all_appointments boolean not null default true,
  can_view_only_own_appointments boolean not null default false,
  can_edit_all_appointments boolean not null default true,
  can_edit_only_own_appointments boolean not null default false,
  can_create_appointments boolean not null default true
);
create table public."Stranke" ("ID stranke" text, "ID Podjetja" text, "Ime" text);
alter table public."Stranke" enable row level security;

-- iz 1793300000_rls_zahteve_odsotnosti_dogodki.sql
create or replace function public.jp_je_clan_podjetja(p_company_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.company_members m join public.companies c on c.id = m.company_id
                 where c.company_id = p_company_id and m.user_id = auth.uid()); $$;

create policy stranke_clan on public."Stranke" for select to authenticated
  using (public.jp_je_clan_podjetja("ID Podjetja"));
grant select on all tables in schema public to authenticated;
