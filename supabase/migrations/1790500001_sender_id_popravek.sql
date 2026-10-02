-- Popravek: jp_sender_id je vrnil napako "column reference company_code is ambiguous".
--
-- Tabela `companies` ima poleg `company_id` tudi stolpec `company_code`, kar je
-- natanko ime mojega parametra. Postgres zato ni vedel, ali mislim parameter
-- ali stolpec, in klic je padel.
--
-- Ime parametra namenoma NE spreminjam, ker ga pod tem imenom kliče `sms-send`.
-- Namesto tega povem plpgsql, naj ob dvoumnosti izbere spremenljivko.
--
-- Posledica napake je bila neškodljiva: klic ni uspel, `sms-send` pa ima
-- varovalko in je pošiljal po privzeti poti, tako kot doslej.

create or replace function public.jp_sender_id(company_code text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  c            record;
  paket_dovoli boolean;
  drzava       text;
begin
  select co.id, co.sms_sender_id, co.sms_sender_id_status, co.sms_sender_id_country
    into c
  from public.companies co
  where co."company_id" = company_code
  limit 1;

  if not found then
    return null;
  end if;

  if c.sms_sender_id_status is distinct from 'odobreno' then
    return null;
  end if;

  if not public.jp_sender_id_veljaven(c.sms_sender_id) then
    return null;
  end if;

  select coalesce(bool_or(p.sender_id_enabled), false)
    into paket_dovoli
  from public.company_subscriptions cs
  join public.plans p on p.id = cs.plan_id
  where cs.company_id = c.id
    and cs.status in ('active', 'trialing');

  if not paket_dovoli then
    return null;
  end if;

  select upper(coalesce(pp."country_code", 'SI')) into drzava
  from public."Podatki podjetij" pp
  where pp."ID Podjetja" = company_code
  limit 1;

  if c.sms_sender_id_country is not null
     and upper(c.sms_sender_id_country) is distinct from coalesce(drzava, 'SI') then
    return null;
  end if;

  return btrim(c.sms_sender_id);
end;
$$;
