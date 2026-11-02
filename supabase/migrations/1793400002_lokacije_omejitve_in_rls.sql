-- Več lokacij na podjetje, 3. del: omejitev števila lokacij in RLS za nove tabele.
--
-- Zahteva 1793400000 in 1793400001.
--
-- Omejitev = plans.max_locations + company_location_limits.extra_locations
-- (enak vzorec kot zaposleni: max_employees + company_user_limits.extra_users).
-- Preverja se v bazi, zato velja za vse poti: aplikacijo, n8n, service role.
-- Nobena številka ni trdo zapisana: nov paket z 5 lokacijami je nova vrednost
-- v plans.max_locations.
--
-- RLS: nove tabele berejo prijavljeni člani podjetja, pisanje ostane prek n8n
-- (service role). Pravice po lokacijah (Clani_Lokacije) veljajo za branje
-- lokacij že zdaj; za Termini in druge obstoječe tabele pridejo v fazi 2, ko
-- bomo obstoječe politike zamenjali (politike se seštevajo, zato dodajanje ne bi
-- ničesar omejilo).
--
-- Zaženi ročno v Supabase SQL editorju. Varno za ponovni zagon.

-- ───────────────────────────────────────────────────────────────────────────
-- Omejitev števila lokacij
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.jp_max_lokacij(p_company text)
returns integer
language sql stable security definer set search_path = public as $$
  select greatest(1,
    coalesce((
      select pl.max_locations
      from public.company_subscriptions s
      join public.plans pl on pl.id = s.plan_id
      where s.company_id = c.id and s.status = 'active'
      limit 1
    ), 1)
    + coalesce((select l.extra_locations from public.company_location_limits l
                where l.company_id = c.id), 0))
  from public.companies c
  where c.company_id = p_company;
$$;

create or replace function public.jp_preveri_stevilo_lokacij()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_aktivne integer;
  v_max     integer;
begin
  if new.status <> 'active' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'active' then
    return new;                       -- ni nove aktivne lokacije
  end if;

  select count(*) into v_aktivne
  from public."Lokacije"
  where "ID podjetja" = new."ID podjetja" and status = 'active' and id <> new.id;

  v_max := coalesce(public.jp_max_lokacij(new."ID podjetja"), 1);

  if v_aktivne + 1 > v_max then
    raise exception 'Omejitev lokacij dosežena (% od %)', v_aktivne, v_max
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists jp_preveri_stevilo_lokacij_t on public."Lokacije";
create trigger jp_preveri_stevilo_lokacij_t
  before insert or update of status on public."Lokacije"
  for each row execute function public.jp_preveri_stevilo_lokacij();

-- Glavne lokacije ni mogoče arhivirati (najprej se določi druga glavna).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'lokacije_glavna_ni_arhivirana') then
    alter table public."Lokacije"
      add constraint lokacije_glavna_ni_arhivirana check (not (je_glavna and status = 'archived'));
  end if;
end $$;

-- ───────────────────────────────────────────────────────────────────────────
-- Dostop do lokacije: član podjetja, ki nima omejitve ali mu je lokacija dodeljena
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.jp_ima_dostop_do_lokacije(p_company text, p_lokacija uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.company_members m
    join public.companies c on c.id = m.company_id
    where c.company_id = p_company and m.user_id = auth.uid()
      and (
        not exists (select 1 from public."Clani_Lokacije" cl
                    where cl.company_id = c.id and cl.user_id = m.user_id)
        or exists (select 1 from public."Clani_Lokacije" cl
                   where cl.company_id = c.id and cl.user_id = m.user_id
                     and cl.lokacija_id = p_lokacija)
      )
  );
$$;

revoke all on function public.jp_max_lokacij(text) from public;
revoke all on function public.jp_ima_dostop_do_lokacije(text, uuid) from public;
grant execute on function public.jp_max_lokacij(text) to authenticated;
grant execute on function public.jp_ima_dostop_do_lokacije(text, uuid) to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- RLS
-- ───────────────────────────────────────────────────────────────────────────
alter table public."Lokacije" enable row level security;
alter table public."Osebe_Lokacije" enable row level security;
alter table public."Storitve_Lokacije" enable row level security;
alter table public."Clani_Lokacije" enable row level security;
alter table public.company_location_limits enable row level security;

drop policy if exists lokacije_clani_berejo on public."Lokacije";
create policy lokacije_clani_berejo on public."Lokacije"
  for select to authenticated
  using (public.jp_ima_dostop_do_lokacije("ID podjetja", id));

drop policy if exists osebe_lokacije_clani_berejo on public."Osebe_Lokacije";
create policy osebe_lokacije_clani_berejo on public."Osebe_Lokacije"
  for select to authenticated
  using (public.jp_je_clan_podjetja("ID podjetja"));

drop policy if exists storitve_lokacije_clani_berejo on public."Storitve_Lokacije";
create policy storitve_lokacije_clani_berejo on public."Storitve_Lokacije"
  for select to authenticated
  using (public.jp_je_clan_podjetja("ID podjetja"));

drop policy if exists clani_lokacije_clani_berejo on public."Clani_Lokacije";
create policy clani_lokacije_clani_berejo on public."Clani_Lokacije"
  for select to authenticated
  using (exists (select 1 from public.company_members m
                 where m.company_id = "Clani_Lokacije".company_id and m.user_id = auth.uid()));

drop policy if exists company_location_limits_clani_berejo on public.company_location_limits;
create policy company_location_limits_clani_berejo on public.company_location_limits
  for select to authenticated
  using (exists (select 1 from public.company_members m
                 where m.company_id = company_location_limits.company_id and m.user_id = auth.uid()));

revoke all on public."Lokacije", public."Osebe_Lokacije", public."Storitve_Lokacije",
              public."Clani_Lokacije", public.company_location_limits from anon;
revoke insert, update, delete on public."Lokacije", public."Osebe_Lokacije",
              public."Storitve_Lokacije", public."Clani_Lokacije",
              public.company_location_limits from authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- Preverjanje po zagonu:
--   select code, max_locations from plans order by code;     -- Pro 3, ostali 1
--   select "ID podjetja", count(*) from "Lokacije" group by 1; -- povsod 1
--   select jp_max_lokacij(company_id) from companies limit 5;
--   -- poskus druge lokacije pri podjetju s paketom Plus mora vrniti napako:
--   --   insert into "Lokacije" ("ID podjetja", naziv) values ('<ID>', 'Test');
-- ───────────────────────────────────────────────────────────────────────────
