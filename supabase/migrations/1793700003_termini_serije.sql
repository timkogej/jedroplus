-- Ponavljajoči termini (docs/glasovni-asistent-dodatne-funkcije-nacrt.md, §6)
--
-- Serija je samo POVEZAVA med običajnimi termini (»serija 2/6«). Vsak termin je navaden
-- zapis v "Termini", shranjen po obstoječi poti (n8n, potrdilo, resursi). Brisanje serije
-- ne briše terminov; odpoved »vseh prihodnjih« gre po isti poti kot odpoved enega.
--
-- * Branje: člani podjetja s pravico do branja terminov (RLS).
-- * Pisanje: samo strežnik (service role) prek jp_termini_serija_dodaj, ki preveri, da so
--   vsi termini res tega podjetja.

create table if not exists public.termini_serije (
  id            uuid primary key default gen_random_uuid(),
  company_id    text not null,
  vsakih_tednov integer not null check (vsakih_tednov between 1 and 26),
  ustvaril      uuid,
  created_at    timestamptz not null default now()
);

create table if not exists public.termini_serije_clani (
  serija_id   uuid not null references public.termini_serije (id) on delete cascade,
  company_id  text not null,
  id_termina  text not null,
  zap         integer not null check (zap between 1 and 12),
  primary key (serija_id, zap),
  unique (company_id, id_termina)
);

create index if not exists termini_serije_clani_podjetje on public.termini_serije_clani (company_id);

alter table public.termini_serije enable row level security;
alter table public.termini_serije_clani enable row level security;
drop policy if exists termini_serije_branje on public.termini_serije;
create policy termini_serije_branje on public.termini_serije for select to authenticated
  using (public.jp_ima_pravico_clana(company_id, 'termini.branje'));
drop policy if exists termini_serije_clani_branje on public.termini_serije_clani;
create policy termini_serije_clani_branje on public.termini_serije_clani for select to authenticated
  using (public.jp_ima_pravico_clana(company_id, 'termini.branje'));
revoke insert, update, delete on public.termini_serije, public.termini_serije_clani from anon, authenticated;
grant select on public.termini_serije, public.termini_serije_clani to authenticated;

-- Poveže shranjene termine v serijo (po vrsti). Termin, ki ni tega podjetja ali je že v
-- drugi seriji, zavrne celo serijo. Vrne id serije.
create or replace function public.jp_termini_serija_dodaj(
  p_company text, p_termini text[], p_vsakih integer, p_user uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id  uuid;
  v_n   integer := coalesce(array_length(p_termini, 1), 0);
  v_ok  integer;
begin
  if v_n < 2 or v_n > 12 then
    return jsonb_build_object('ok', false, 'koda', 'stevilo');
  end if;
  if (select count(distinct x) from unnest(p_termini) x) <> v_n then
    return jsonb_build_object('ok', false, 'koda', 'podvojeni');
  end if;
  select count(*) into v_ok from public."Termini" t
   where t."ID podjetja" = p_company and t."ID termina" = any (p_termini) and t.deleted_at is null;
  if v_ok <> v_n then
    return jsonb_build_object('ok', false, 'koda', 'tuji_termini');
  end if;
  if exists (select 1 from public.termini_serije_clani c where c.company_id = p_company and c.id_termina = any (p_termini)) then
    return jsonb_build_object('ok', false, 'koda', 'ze_v_seriji');
  end if;
  insert into public.termini_serije (company_id, vsakih_tednov, ustvaril)
  values (p_company, p_vsakih, p_user) returning id into v_id;
  insert into public.termini_serije_clani (serija_id, company_id, id_termina, zap)
  select v_id, p_company, x, i from unnest(p_termini) with ordinality as u(x, i);
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

revoke all on function public.jp_termini_serija_dodaj(text, text[], integer, uuid) from public, anon, authenticated;
grant execute on function public.jp_termini_serija_dodaj(text, text[], integer, uuid) to service_role;
