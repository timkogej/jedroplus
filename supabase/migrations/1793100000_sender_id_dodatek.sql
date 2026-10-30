-- Lasten sender ID kot mesečni dodatek (+4,90 €/mesec) za paket Pro.
--
-- Doslej je ime pošiljatelja dovolil samo paket z `sender_id_enabled`
-- (Jedro Premium). Zdaj ga lahko kupi vsako podjetje na paketu Pro.
--
-- Pravilo ostane na enem mestu, v bazi. Ime se uporabi, če so izpolnjeni vsi
-- pogoji:
--   1. podjetje ima aktivno naročnino in paket dovoli ime (stara zastavica
--      `sender_id_enabled`) ALI ima plačan dodatek na paketu Pro ali višjem,
--   2. ime je pri BulkGate ODOBRENO (to vpiše Tim ročno),
--   3. odobritev velja za državo, v kateri je podjetje.
--
-- Če naročnina poteče ali podjetje pade pod Pro, se dodatek ne briše, a ime
-- se ne uporablja več. Ko je naročnina spet aktivna, deluje takoj.

alter table public.companies
  add column if not exists sms_sender_id_addon boolean not null default false,
  add column if not exists sms_sender_id_addon_item_id text;

-- Ali je ime prosto: nobeno drugo podjetje ga nima zaprošenega ali odobrenega.
-- Primerjava ne razlikuje velikih in malih črk ter presledkov na robu.
create or replace function public.jp_sender_id_prosto(ime text, company_code text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_variable
begin
  return not exists (
    select 1
    from public.companies co
    where lower(btrim(co.sms_sender_id)) = lower(btrim(ime))
      and co.sms_sender_id_status in ('v_obdelavi', 'odobreno')
      and co."company_id" is distinct from company_code
  );
end;
$$;

grant execute on function public.jp_sender_id_prosto(text, text)
  to authenticated, service_role;

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
  select co.id, co.sms_sender_id, co.sms_sender_id_status,
         co.sms_sender_id_country, co.sms_sender_id_addon
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

  select coalesce(bool_or(
           p.sender_id_enabled
           or (c.sms_sender_id_addon
               and p.code in ('JEDRO_PRO', 'JEDRO_PREMIUM'))
         ), false)
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

-- Stanje za prikaz v aplikaciji. Dodana sta `moze_kupiti` (paket je Pro ali
-- višji, torej se dodatek sploh lahko kupi) in `dodatek` (je že plačan).
-- `dovoljen` pomeni, da je ime zdaj dovoljeno uporabljati: stari paket ali
-- plačan dodatek.
drop function if exists public.jp_sender_id_stanje(text);

create function public.jp_sender_id_stanje(company_code text)
returns table (
  dovoljen     boolean,
  ime          text,
  status       text,
  drzava       text,
  opomba       text,
  v_uporabi    text,
  moze_kupiti  boolean,
  dodatek      boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  c record;
begin
  select co.id, co.sms_sender_id, co.sms_sender_id_status,
         co.sms_sender_id_country, co.sms_sender_id_note,
         co.sms_sender_id_addon
    into c
  from public.companies co
  where co."company_id" = company_code
  limit 1;

  if not found then
    return;
  end if;

  return query
  select
    coalesce((
      select bool_or(p.sender_id_enabled
                     or (c.sms_sender_id_addon
                         and p.code in ('JEDRO_PRO', 'JEDRO_PREMIUM')))
      from public.company_subscriptions cs
      join public.plans p on p.id = cs.plan_id
      where cs.company_id = c.id
        and cs.status in ('active', 'trialing')
    ), false),
    c.sms_sender_id,
    c.sms_sender_id_status,
    c.sms_sender_id_country,
    c.sms_sender_id_note,
    public.jp_sender_id(company_code),
    coalesce((
      select bool_or(p.code in ('JEDRO_PRO', 'JEDRO_PREMIUM'))
      from public.company_subscriptions cs
      join public.plans p on p.id = cs.plan_id
      where cs.company_id = c.id
        and cs.status in ('active', 'trialing')
    ), false),
    c.sms_sender_id_addon;
end;
$$;

grant execute on function public.jp_sender_id_stanje(text)
  to authenticated, service_role;
