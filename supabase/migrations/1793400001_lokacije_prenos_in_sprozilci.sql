-- Več lokacij na podjetje, 2. del: prenos podatkov in varnostna mreža.
--
-- Zahteva 1793400000.
--
-- 1) Vsako podjetje dobi glavno lokacijo iz "Podatki podjetij" (naslov, telefon,
--    e-pošta, urnik, povezava za oceno).
-- 2) Vsaka oseba je povezana z glavno lokacijo; termini in viri jo dobijo v
--    stolpec lokacija_id. Storitve_Lokacije ostane prazna (= povsod).
-- 3) Sprožilci, da stari tokovi (n8n, Receptionist+, portal), ki lokacije ne
--    poznajo, še naprej delujejo: termin/vir/zahteva brez lokacije dobi glavno,
--    nova oseba se poveže z glavno, novo podjetje dobi glavno lokacijo.
-- 4) Dokler se stara polja še berejo ("Naslov podjetja", "Kontaktni telefon",
--    urnik, povezava_ocena v "Podatki podjetij"), se spremembe prenašajo v obe
--    smeri med njimi in glavno lokacijo. Sprožilec zgodovine terminov
--    stolpca lokacija_id ne spremlja, zato prenos ne ustvari zapisov zgodovine.
--
-- Zaženi ročno v Supabase SQL editorju. Varno za ponovni zagon.

-- ───────────────────────────────────────────────────────────────────────────
-- Pomočnik: glavna lokacija podjetja
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.jp_glavna_lokacija(p_company text)
returns uuid
language sql stable security definer set search_path = public as $$
  select id from public."Lokacije"
  where "ID podjetja" = p_company and je_glavna
  limit 1;
$$;

-- Ustvari ali uskladi glavno lokacijo s starimi polji podjetja.
create or replace function public.jp_uskladi_glavno_lokacijo(p_company text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  p  record;
  c  record;
begin
  select * into c from public.companies where company_id = p_company;
  if not found then
    return;
  end if;
  select * into p from public."Podatki podjetij" where "ID Podjetja" = p_company;

  if not exists (select 1 from public."Lokacije" where "ID podjetja" = p_company and je_glavna) then
    insert into public."Lokacije"
      ("ID podjetja", naziv, naslov, telefon, email, urnik, povezava_ocena, je_glavna)
    values (
      p_company,
      coalesce(nullif(btrim(p."Naziv Podjetja"), ''), c.name),
      p."Naslov podjetja", p."Kontaktni telefon", p."Kontaktni_email",
      p.urnik, p.povezava_ocena, true);
  else
    update public."Lokacije" l
       set naslov = p."Naslov podjetja",
           telefon = p."Kontaktni telefon",
           email = p."Kontaktni_email",
           urnik = p.urnik,
           povezava_ocena = p.povezava_ocena,
           updated_at = now()
     where l."ID podjetja" = p_company and l.je_glavna
       and p."ID Podjetja" is not null
       and (l.naslov, l.telefon, l.email, l.urnik, l.povezava_ocena)
           is distinct from
           (p."Naslov podjetja", p."Kontaktni telefon", p."Kontaktni_email", p.urnik, p.povezava_ocena);
  end if;
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 1) Glavne lokacije obstoječih podjetij
-- ───────────────────────────────────────────────────────────────────────────
select public.jp_uskladi_glavno_lokacijo(company_id) from public.companies;

-- ───────────────────────────────────────────────────────────────────────────
-- 2) Osebe, termini, viri
-- ───────────────────────────────────────────────────────────────────────────
insert into public."Osebe_Lokacije" ("ID podjetja", "ID osebe", lokacija_id)
select o."ID podjetja", o."ID osebe", l.id
from public."Osebe" o
join public."Lokacije" l on l."ID podjetja" = o."ID podjetja" and l.je_glavna
on conflict do nothing;

update public."Termini" t
   set lokacija_id = l.id
  from public."Lokacije" l
 where l."ID podjetja" = t."ID podjetja" and l.je_glavna and t.lokacija_id is null;

update public."Resursi" r
   set lokacija_id = l.id
  from public."Lokacije" l
 where l."ID podjetja" = r."ID podjetja" and l.je_glavna and r.lokacija_id is null;

update public.zahteve_termini z
   set lokacija_id = l.id
  from public."Lokacije" l
 where l."ID podjetja" = z."ID podjetja" and l.je_glavna and z.lokacija_id is null;

-- ───────────────────────────────────────────────────────────────────────────
-- 3) Varnostna mreža: brez lokacije = glavna lokacija
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.jp_privzeta_lokacija()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.lokacija_id is null then
    new.lokacija_id := public.jp_glavna_lokacija(new."ID podjetja");
  end if;
  return new;
end;
$$;

drop trigger if exists jp_privzeta_lokacija_t on public."Termini";
create trigger jp_privzeta_lokacija_t
  before insert or update of lokacija_id on public."Termini"
  for each row execute function public.jp_privzeta_lokacija();

drop trigger if exists jp_privzeta_lokacija_t on public."Resursi";
create trigger jp_privzeta_lokacija_t
  before insert or update of lokacija_id on public."Resursi"
  for each row execute function public.jp_privzeta_lokacija();

drop trigger if exists jp_privzeta_lokacija_t on public.zahteve_termini;
create trigger jp_privzeta_lokacija_t
  before insert or update of lokacija_id on public.zahteve_termini
  for each row execute function public.jp_privzeta_lokacija();

-- Nova oseba dobi glavno lokacijo.
create or replace function public.jp_oseba_glavna_lokacija()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_lok uuid;
begin
  v_lok := public.jp_glavna_lokacija(new."ID podjetja");
  if v_lok is not null then
    insert into public."Osebe_Lokacije" ("ID podjetja", "ID osebe", lokacija_id)
    values (new."ID podjetja", new."ID osebe", v_lok)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists jp_oseba_glavna_lokacija_t on public."Osebe";
create trigger jp_oseba_glavna_lokacija_t
  after insert on public."Osebe"
  for each row execute function public.jp_oseba_glavna_lokacija();

-- ───────────────────────────────────────────────────────────────────────────
-- 4) Usklajevanje starih polj in glavne lokacije
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.jp_podjetje_nova_lokacija()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.jp_uskladi_glavno_lokacijo(new.company_id);
  return new;
end;
$$;

drop trigger if exists jp_podjetje_nova_lokacija_t on public.companies;
create trigger jp_podjetje_nova_lokacija_t
  after insert on public.companies
  for each row execute function public.jp_podjetje_nova_lokacija();

create or replace function public.jp_podatki_v_lokacijo()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.jp_uskladi_glavno_lokacijo(new."ID Podjetja");
  return new;
end;
$$;

drop trigger if exists jp_podatki_v_lokacijo_t on public."Podatki podjetij";
create trigger jp_podatki_v_lokacijo_t
  after insert or update of "Naslov podjetja", "Kontaktni telefon", "Kontaktni_email", urnik, povezava_ocena
  on public."Podatki podjetij"
  for each row execute function public.jp_podatki_v_lokacijo();

-- Obratna smer: sprememba glavne lokacije se prepiše v stara polja.
create or replace function public.jp_lokacija_v_podatke()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.je_glavna then
    update public."Podatki podjetij" p
       set "Naslov podjetja" = coalesce(new.naslov, p."Naslov podjetja"),
           "Kontaktni telefon" = coalesce(new.telefon, p."Kontaktni telefon"),
           "Kontaktni_email"   = coalesce(new.email, p."Kontaktni_email"),
           urnik = coalesce(new.urnik, p.urnik),
           povezava_ocena = coalesce(new.povezava_ocena, p.povezava_ocena)
     where p."ID Podjetja" = new."ID podjetja"
       and (p."Naslov podjetja", p."Kontaktni telefon", p."Kontaktni_email", p.urnik, p.povezava_ocena)
           is distinct from
           (coalesce(new.naslov, p."Naslov podjetja"), coalesce(new.telefon, p."Kontaktni telefon"),
            coalesce(new.email, p."Kontaktni_email"), coalesce(new.urnik, p.urnik),
            coalesce(new.povezava_ocena, p.povezava_ocena));
  end if;
  return new;
end;
$$;

drop trigger if exists jp_lokacija_v_podatke_t on public."Lokacije";
create trigger jp_lokacija_v_podatke_t
  after update of naslov, telefon, email, urnik, povezava_ocena on public."Lokacije"
  for each row execute function public.jp_lokacija_v_podatke();

-- ───────────────────────────────────────────────────────────────────────────
-- Preverjanje po zagonu (vsi trije razlikovalniki morajo biti 0):
--   select count(*) from "Termini" where lokacija_id is null;
--   select count(*) from "Resursi" where lokacija_id is null;
--   select count(*) from companies c
--     where not exists (select 1 from "Lokacije" l where l."ID podjetja" = c.company_id and l.je_glavna);
--   select count(*) from "Osebe" o
--     where not exists (select 1 from "Osebe_Lokacije" ol
--                       where ol."ID podjetja" = o."ID podjetja" and ol."ID osebe" = o."ID osebe");
-- Število terminov mora ostati 1834.
-- ───────────────────────────────────────────────────────────────────────────
