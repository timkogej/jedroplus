-- 1793700000_glas_sporocila.sql
--
-- Asistent+: »sporoči stranki« (docs/glasovni-asistent-dodatne-funkcije-nacrt.md, §3).
-- Ena vrstica na sporočilo, ki ga je uporabnik potrdil. Besedila NE hranimo
-- (je v message_outbox, ki ga zapiše n8n tok glas-sporocilo, kot pri Receptionist+).
--
-- Omejitev (Timova odločitev O1): največ 3 sporočila na stranko in 30 na podjetje
-- na dan (pas Europe/Ljubljana), poleg skupne mesečne SMS kvote, ki jo preveri n8n.
-- Rezervacija je atomarna (zaklep na podjetje), samo service role.
--
-- Migracija je idempotentna. Nazaj:
--   drop function if exists jp_glas_rezerviraj_sporocilo(text, uuid, uuid, text, text, text, integer, integer, integer);
--   drop function if exists jp_glas_zakljuci_sporocilo(uuid, text, text);
--   drop table if exists glas_sporocila;

create table if not exists public.glas_sporocila (
  id           uuid primary key default gen_random_uuid(),
  company_id   text not null,                                   -- companies.company_id
  user_id      uuid not null,
  ukaz_id      uuid,                                            -- glas_ukazi.id
  id_stranke   text not null,
  id_termina   text not null,
  kanal        text not null check (kanal in ('sms', 'email')),
  dolzina      integer not null check (dolzina between 1 and 2000),
  -- v_vrsti: rezervirano, pošiljanje teče; neznano: n8n ni odgovoril (lahko je bilo poslano)
  status       text not null default 'v_vrsti'
               check (status in ('v_vrsti', 'poslano', 'napaka', 'kvota', 'blokirano', 'neznano')),
  razlog       text,                                            -- koda (quota_exceeded, blocked_country …), nikoli besedilo
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists glas_sporocila_podjetje_idx on public.glas_sporocila (company_id, created_at desc);
create index if not exists glas_sporocila_stranka_idx on public.glas_sporocila (company_id, id_stranke, created_at desc);

alter table public.glas_sporocila enable row level security;

drop policy if exists glas_sporocila_branje on public.glas_sporocila;
create policy glas_sporocila_branje on public.glas_sporocila for select to authenticated
  using (public.jp_ima_pravico_clana(company_id, 'termini.branje'));

revoke insert, update, delete on public.glas_sporocila from anon, authenticated;

-- Rezervira eno sporočilo, če omejitev dovoli. Šteje sporočila, ki so ali bi lahko
-- bila poslana (v_vrsti, poslano, neznano); neuspešna (kvota, blokirano, napaka) ne.
-- Vrne {ok:true, id} ali {ok:false, koda:'stranka'|'podjetje', poslanih}.
create or replace function public.jp_glas_rezerviraj_sporocilo(
  p_company text, p_user uuid, p_ukaz uuid, p_stranka text, p_termin text, p_kanal text,
  p_dolzina integer, p_na_stranko integer, p_na_podjetje integer)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_dan_od  timestamptz := date_trunc('day', now() at time zone 'Europe/Ljubljana') at time zone 'Europe/Ljubljana';
  v_podj    integer;
  v_stranka integer;
  v_id      uuid;
begin
  perform pg_advisory_xact_lock(hashtext('glas_sporocila:' || p_company));

  select count(*) into v_podj from public.glas_sporocila
   where company_id = p_company and created_at >= v_dan_od
     and status in ('v_vrsti', 'poslano', 'neznano');
  if v_podj >= p_na_podjetje then
    return jsonb_build_object('ok', false, 'koda', 'podjetje', 'poslanih', v_podj);
  end if;

  select count(*) into v_stranka from public.glas_sporocila
   where company_id = p_company and id_stranke = p_stranka and created_at >= v_dan_od
     and status in ('v_vrsti', 'poslano', 'neznano');
  if v_stranka >= p_na_stranko then
    return jsonb_build_object('ok', false, 'koda', 'stranka', 'poslanih', v_stranka);
  end if;

  insert into public.glas_sporocila (company_id, user_id, ukaz_id, id_stranke, id_termina, kanal, dolzina)
  values (p_company, p_user, p_ukaz, p_stranka, p_termin, p_kanal, p_dolzina)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- Zapiše izid pošiljanja (samo iz v_vrsti; ponovni klic ničesar ne spremeni).
create or replace function public.jp_glas_zakljuci_sporocilo(p_id uuid, p_status text, p_razlog text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('poslano', 'napaka', 'kvota', 'blokirano', 'neznano') then
    raise exception 'neveljaven status %', p_status;
  end if;
  update public.glas_sporocila
     set status = p_status, razlog = left(p_razlog, 60), updated_at = now()
   where id = p_id and status = 'v_vrsti';
end;
$$;

revoke all on function public.jp_glas_rezerviraj_sporocilo(text, uuid, uuid, text, text, text, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.jp_glas_zakljuci_sporocilo(uuid, text, text) from public, anon, authenticated;
grant execute on function public.jp_glas_rezerviraj_sporocilo(text, uuid, uuid, text, text, text, integer, integer, integer) to service_role;
grant execute on function public.jp_glas_zakljuci_sporocilo(uuid, text, text) to service_role;
