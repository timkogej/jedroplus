-- Preizkus migracije 1793700002_glas_opomniki.sql (zažene tests/glas/sql/zazeni.sh).
-- Nadomestka za Termini in notifications (produkcijski tabeli imata več stolpcev).
\set ON_ERROR_STOP on
create table if not exists public."Termini" (
  "ID termina" text, "ID podjetja" text, "Datum" date, "Čas" text, "Status" text, deleted_at timestamptz);
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(), company_id uuid, recipient_user_id uuid, type text, severity text,
  title text, body text, entity_type text, entity_id text, dedupe_key text unique, created_at timestamptz default now());
grant all on all tables in schema public to authenticated, service_role;

create or replace function pg_temp.mora(p boolean, opis text) returns void language plpgsql as $$
begin if not coalesce(p, false) then raise exception 'NEUSPEH: %', opis; end if;
      raise notice 'ok: %', opis; end $$;

insert into companies values ('aaaaaaaa-0000-0000-0000-00000000000a', 'OPOM01') on conflict do nothing;
insert into company_members values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'owner', null),
  ('aaaaaaaa-0000-0000-0000-00000000000a', '22222222-2222-2222-2222-222222222222', 'staff', null);

-- 1. Omejitev čakajočih (v preizkusu 3)
select pg_temp.mora((jp_glas_dodaj_opomnik('OPOM01', 'aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'pokliči dobavitelja', now() - interval '1 minute', null, null, 'Europe/Ljubljana', 'sl', null, 3)->>'ok')::boolean, 'dospel opomnik');
select pg_temp.mora((jp_glas_dodaj_opomnik('OPOM01', 'aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'jutri', now() + interval '1 day', null, null, 'Europe/Ljubljana', 'en', null, 3)->>'ok')::boolean, 'prihodnji opomnik');
select pg_temp.mora((jp_glas_dodaj_opomnik('OPOM01', 'aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'star', now() - interval '30 hours', null, null, 'Europe/Ljubljana', 'sl', null, 3)->>'ok')::boolean, 'star opomnik');
select pg_temp.mora((jp_glas_dodaj_opomnik('OPOM01', 'aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'četrti', now(), null, null, 'Europe/Ljubljana', 'sl', null, 3)->>'koda') = 'omejitev', 'omejitev čakajočih');

-- 2. Vezan na termin: prestavljen termin premakne čas; odpovedan prekliče in obvesti.
insert into "Termini" values ('T-A', 'OPOM01', current_date + 2, '10:00', 'scheduled', null), ('T-B', 'OPOM01', current_date + 1, '09:00', 'Odpovedan', null);
select pg_temp.mora((jp_glas_dodaj_opomnik('OPOM01', 'aaaaaaaa-0000-0000-0000-00000000000a', '22222222-2222-2222-2222-222222222222', 'povej ji za barvo', null, 'T-A', '501', 'Europe/Ljubljana', 'sl', null, 50)->>'ok')::boolean, 'vezan opomnik A');
select pg_temp.mora((jp_glas_dodaj_opomnik('OPOM01', 'aaaaaaaa-0000-0000-0000-00000000000a', '22222222-2222-2222-2222-222222222222', 'vrni ji glavnik', null, 'T-B', '502', 'Europe/Ljubljana', 'sl', null, 50)->>'ok')::boolean, 'vezan opomnik B');

-- 3. Tek: dva vzporedna klica pošljeta samo enkrat (dedupe_key + skip locked).
select pg_temp.mora(jp_glas_opomniki_tek() = 1, 'tek pošlje dospel opomnik');
select pg_temp.mora(jp_glas_opomniki_tek() = 0, 'drugi tek ne pošlje znova');
select pg_temp.mora((select count(*) = 1 from notifications where dedupe_key like 'glas_opomnik_%' and dedupe_key not like '%preklic%'), 'eno obvestilo');
select pg_temp.mora((select recipient_user_id = '11111111-1111-1111-1111-111111111111' and title = 'Opomnik' and body = 'pokliči dobavitelja' from notifications where entity_type = 'glas_opomnik' and dedupe_key not like '%preklic%'), 'prejemnik in besedilo');
select pg_temp.mora((select stanje = 'potekel' from glas_opomniki where besedilo = 'star'), 'starejši od 24 h → potekel');
select pg_temp.mora((select stanje = 'caka' from glas_opomniki where besedilo = 'jutri'), 'prihodnji čaka');
select pg_temp.mora((select ob = ((current_date + 2) + time '10:00') at time zone 'Europe/Ljubljana' from glas_opomniki where id_termina = 'T-A'), 'vezan: čas termina');
select pg_temp.mora((select stanje = 'preklican' from glas_opomniki where id_termina = 'T-B'), 'odpovedan termin → preklican');
select pg_temp.mora((select body like 'Termin je odpovedan: vrni ji glavnik' from notifications where dedupe_key like 'glas_opomnik_preklic_%'), 'obvestilo o preklicu');
update "Termini" set "Datum" = current_date + 3, "Čas" = '12:30' where "ID termina" = 'T-A';
select jp_glas_opomniki_tek();
select pg_temp.mora((select ob = ((current_date + 3) + time '12:30') at time zone 'Europe/Ljubljana' from glas_opomniki where id_termina = 'T-A'), 'prestavljen termin premakne opomnik');
update "Termini" set "Datum" = (now() at time zone 'Europe/Ljubljana' - interval '1 hour')::date,
  "Čas" = to_char(now() at time zone 'Europe/Ljubljana' - interval '1 hour', 'HH24:MI') where "ID termina" = 'T-A';
select pg_temp.mora(jp_glas_opomniki_tek() = 1, 'termin, ki je že začel → pošlje');

-- 4. Preklic samo svojega
select pg_temp.mora(not jp_glas_preklici_opomnik((select id from glas_opomniki where besedilo = 'jutri'), 'OPOM01', '22222222-2222-2222-2222-222222222222'), 'tujega ne prekliče');
select pg_temp.mora(jp_glas_preklici_opomnik((select id from glas_opomniki where besedilo = 'jutri'), 'OPOM01', '11111111-1111-1111-1111-111111111111'), 'svojega prekliče');

-- 5. RLS: drug uporabnik ne vidi tujih; anon/authenticated ne pišeta
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
select pg_temp.mora((select count(*) = 0 from glas_opomniki where user_id = '11111111-1111-1111-1111-111111111111'), 'RLS: tujih ne vidi');
do $$ begin
  insert into glas_opomniki (company_id, company_uuid, user_id, besedilo, ob) values ('OPOM01', 'aaaaaaaa-0000-0000-0000-00000000000a', '22222222-2222-2222-2222-222222222222', 'x', now());
  raise exception 'NEUSPEH: authenticated je smel pisati';
exception when insufficient_privilege then raise notice 'ok: authenticated ne piše'; end $$;
do $$ begin
  perform jp_glas_opomniki_tek();
  raise exception 'NEUSPEH: authenticated je smel pognati tek';
exception when insufficient_privilege then raise notice 'ok: tek samo service role'; end $$;
reset role;
