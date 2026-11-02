-- Več lokacij na podjetje, 1. del: tabele in stolpci.
--
-- Samo dodaja. Nobena obstoječa vrstica se ne spremeni, nobena aplikacija ne
-- opazi razlike: novi stolpci so prazni, nove tabele prazne. Prenos obstoječih
-- podatkov je v 1793400001, omejitve in RLS v 1793400002.
--
-- Model: ena tabela "Lokacije" znotraj podjetja (ne eno podjetje na lokacijo).
--   "Lokacije"          lokacije podjetja; ena je glavna (je_glavna)
--   "Osebe_Lokacije"    kdo dela kje; urnik po lokaciji (NULL = urnik osebe)
--   "Storitve_Lokacije" kje se storitev izvaja; BREZ vrstic = povsod
--   "Clani_Lokacije"    do katerih lokacij ima dostop član; BREZ vrstic = vse
--   company_location_limits  doplačane lokacije (po vzoru company_user_limits)
--   lokacija_id         na Termini, Resursi, events, zahteve_termini,
--                       receptionist_phone_numbers, receptionist_calls
--                       (events: NULL = velja za vse lokacije;
--                        receptionist_phone_numbers: NULL = skupna številka)
--
-- ID podjetja je povsod besedilni (companies.company_id, npr. 7LHB28); članstvo
-- in omejitve uporabljajo uuid (companies.id).
--
-- Zaženi ročno v Supabase SQL editorju. Varno za ponovni zagon.

create table if not exists public."Lokacije" (
  id              uuid primary key default gen_random_uuid(),
  "ID podjetja"   text not null references public.companies(company_id) on delete cascade,
  naziv           text not null,
  naslov          text,
  telefon         text,
  email           text,
  urnik           text,                       -- isti JSON kot "Podatki podjetij".urnik
  povezava_ocena  text,
  je_glavna       boolean not null default false,
  status          text not null default 'active' check (status in ('active', 'archived')),
  zaporedje       integer not null default 0,
  cas_poti_min    integer not null default 0 check (cas_poti_min >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Največ ena glavna lokacija na podjetje.
create unique index if not exists lokacije_ena_glavna_idx
  on public."Lokacije" ("ID podjetja") where je_glavna;
create index if not exists lokacije_podjetje_idx
  on public."Lokacije" ("ID podjetja", status);

create table if not exists public."Osebe_Lokacije" (
  "ID podjetja"  text not null,
  "ID osebe"     text not null,
  lokacija_id    uuid not null references public."Lokacije"(id) on delete cascade,
  urnik          text,                        -- NULL = urnik osebe
  created_at     timestamptz not null default now(),
  primary key (lokacija_id, "ID osebe"),
  foreign key ("ID podjetja", "ID osebe")
    references public."Osebe" ("ID podjetja", "ID osebe") on delete cascade
);
create index if not exists osebe_lokacije_oseba_idx
  on public."Osebe_Lokacije" ("ID podjetja", "ID osebe");

create table if not exists public."Storitve_Lokacije" (
  "ID podjetja"  text not null,
  "ID storitve"  text not null,
  lokacija_id    uuid not null references public."Lokacije"(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (lokacija_id, "ID storitve"),
  foreign key ("ID podjetja", "ID storitve")
    references public."Storitve" ("ID podjetja", "ID storitve") on delete cascade
);
create index if not exists storitve_lokacije_storitev_idx
  on public."Storitve_Lokacije" ("ID podjetja", "ID storitve");

create table if not exists public."Clani_Lokacije" (
  company_id   uuid not null references public.companies(id) on delete cascade,
  user_id      uuid not null,
  lokacija_id  uuid not null references public."Lokacije"(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (user_id, lokacija_id)
);
create index if not exists clani_lokacije_podjetje_idx
  on public."Clani_Lokacije" (company_id, user_id);

create table if not exists public.company_location_limits (
  company_id                  uuid primary key references public.companies(id) on delete cascade,
  extra_locations             integer not null default 0 check (extra_locations >= 0),
  stripe_subscription_item_id text,
  cancel_at_period_end        boolean not null default false,
  updated_at                  timestamptz not null default now()
);

-- Stolpec lokacija_id. Brez FK-ja na brisanje: lokacije se arhivirajo, ne brišejo.
do $$
declare t text;
begin
  foreach t in array array[
    'Termini', 'Resursi', 'events', 'zahteve_termini',
    'receptionist_phone_numbers', 'receptionist_calls'
  ] loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format(
        'alter table public.%I add column if not exists lokacija_id uuid references public."Lokacije"(id)', t);
      execute format(
        'create index if not exists %I on public.%I (lokacija_id)', t || '_lokacija_idx', t);
    end if;
  end loop;
end $$;

-- Najpogostejša poizvedba: termini podjetja na lokaciji v obdobju.
create index if not exists termini_podjetje_lokacija_datum_idx
  on public."Termini" ("ID podjetja", lokacija_id, "Datum");

-- Koliko lokacij vključuje paket. Dodatne se prištejejo iz company_location_limits.
alter table public.plans add column if not exists max_locations integer not null default 1;
update public.plans set max_locations = 3 where code = 'JEDRO_PRO' and max_locations = 1;

comment on table public."Lokacije" is
  'Lokacije podjetja. Podjetje z eno lokacijo ima samo glavno (je_glavna), ki odraža stara polja v "Podatki podjetij".';
comment on table public."Storitve_Lokacije" is
  'Kje se storitev izvaja. Storitva brez vrstic je na voljo na vseh lokacijah.';
comment on table public."Clani_Lokacije" is
  'Dostop člana do lokacij. Član brez vrstic vidi vse lokacije.';
