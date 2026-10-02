-- Lasten sender ID (ime pošiljatelja SMS) za podjetja.
--
-- Tri stvari morajo biti izpolnjene hkrati, da se uporabi lastno ime:
--   1. paket podjetja ima to lastnost,
--   2. ime je pri BulkGate ODOBRENO,
--   3. odobritev velja za državo, v kateri je podjetje zdaj.
--
-- Odločitev je namenoma v bazi in ne v vmesniku. Če bi bila samo v aplikaciji,
-- bi podjetje ob vrnitvi na nižji paket še naprej pošiljalo s svojim imenom,
-- ker bi vrednost v bazi ostala. Tako pa odloča `sms-send` ob vsakem pošiljanju.
--
-- Ob vrnitvi na nižji paket se vrednost NE briše — samo ne uporablja se.
-- Ko podjetje paket spet kupi, deluje takoj, brez ponovnega čakanja na BulkGate.

-- 1) Lastnost paketa. Tabela `plans` ima ta vzorec že pri sms_enabled,
--    chatbot_enabled, booking_enabled ... Tako ob novem paketu ni treba
--    nazaj v tokove — dovolj je prižgati zastavico.
alter table public.plans
  add column if not exists sender_id_enabled boolean not null default false;

update public.plans set sender_id_enabled = true where code = 'JEDRO_PREMIUM';

-- 2) Stanje odobritve. Odobritev pri BulkGate ni takojšnja in traja dneve,
--    zato to ni preklopno stikalo, ampak stanje z več koraki.
alter table public.companies
  add column if not exists sms_sender_id_status text not null default 'ni_zaproseno',
  add column if not exists sms_sender_id_country text,
  add column if not exists sms_sender_id_note text,
  add column if not exists sms_sender_id_requested_at timestamptz,
  add column if not exists sms_sender_id_decided_at timestamptz;

do $$
begin
  alter table public.companies
    add constraint companies_sms_sender_id_status_check
    check (sms_sender_id_status in
           ('ni_zaproseno', 'v_obdelavi', 'odobreno', 'zavrnjeno'));
exception
  when duplicate_object then null;
end;
$$;

-- 3) Ali je ime sploh uporabno za BulkGate.
--    Največ 11 znakov, samo črke, številke in presledki, brez šumnikov,
--    in ne sme biti sama številka (tako bi ga omrežje razumelo kot številko).
create or replace function public.jp_sender_id_veljaven(ime text)
returns boolean
language sql
immutable
as $$
  select ime is not null
     and btrim(ime) <> ''
     and length(btrim(ime)) <= 11
     and btrim(ime) ~ '^[A-Za-z0-9 ]+$'
     and btrim(ime) !~ '^[0-9 ]+$';
$$;

-- 4) Katero ime naj se dejansko uporabi.
--    Vrne ime, če so izpolnjeni vsi pogoji, sicer NULL = pošlji po privzeti poti.
--
--    security definer: kliče ga `sms-send` s servisnim ključem, a tudi
--    aplikacija, da lahko podjetju pokaže, kaj bo dejansko uporabljeno.
--    Vrne eno besedo za podjetje, ki ga klicatelj že pozna.
create or replace function public.jp_sender_id(company_code text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
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

  -- Paket mora imeti to lastnost.
  select coalesce(bool_or(p.sender_id_enabled), false)
    into paket_dovoli
  from public.company_subscriptions cs
  join public.plans p on p.id = cs.plan_id
  where cs.company_id = c.id
    and cs.status in ('active', 'trialing');

  if not paket_dovoli then
    return null;
  end if;

  -- Odobritev velja le za državo, za katero je bila dana. Če se je podjetje
  -- medtem preselilo, ime tam ni odobreno in bi ga operater lahko zavrnil
  -- ali zamenjal — raje se tiho vrnemo na privzeto pošiljanje.
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

grant execute on function public.jp_sender_id_veljaven(text) to authenticated, anon, service_role;
grant execute on function public.jp_sender_id(text) to authenticated, anon, service_role;
