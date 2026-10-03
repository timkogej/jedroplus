-- Zgodovina akcij prek sprožilcev v bazi.
--
-- Doslej je zgodovino pisala samo aplikacija, in to z dveh mest. Vse ostalo —
-- n8n, Booking v2, portal, uvoz — piše v "Termini" in "Stranke" mimo nje, zato
-- je v štirih mesecih nastalo 57 zapisov treh vrst, stran pa ponuja filtre za
-- devet. Pravilo gre zato v bazo: sprožilec ujame vsakega pisalca naenkrat in
-- noben nov tok tega ne more pozabiti.
--
-- Pripisa (kdo je naredil) baza sama ne more vedeti. Aplikacija v "Termini"
-- neposredno piše samo mehki izbris; vse drugo teče skozi n8n s servisnim
-- ključem, kjer auth.uid() ni na voljo. Zato je tu kljuka jp.izvedel in
-- jp.izvedel_tip, ki jo posamezen tok napolni kasneje — dokler je nihče ne
-- nastavi, se zapiše 'sistem'. Tako se popolnost dobi takoj, pripis pa se
-- izboljšuje po tokovih, brez ponovnega spreminjanja sprožilcev.
--
-- Opomba o času: zgodovina.created_at je `timestamp without time zone` in hrani
-- UTC (PostgREST vrača vrednosti brez odmika). Zato tu povsod računamo z
-- (now() at time zone 'utc') in created_at vpisujemo izrecno, da je varovalka
-- proti podvajanju primerljiva z istim merilom.

-- ───────────────────────────────────────────────────────────────────────────
-- 1) Kdo je akter
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.jp_zgodovina_akter(p_company_code text)
returns table (izvedel text, izvedel_tip text)
language plpgsql
stable
security definer
set search_path = public
as $jp_akter$
declare
  v_guc_kdo text := nullif(btrim(coalesce(current_setting('jp.izvedel', true), '')), '');
  v_guc_tip text := nullif(btrim(coalesce(current_setting('jp.izvedel_tip', true), '')), '');
  v_uid     uuid;
  v_email   text;
  v_role    text;
begin
  -- a) kar je tok izrecno povedal (plast 2)
  if v_guc_tip is not null then
    return query select v_guc_kdo, v_guc_tip;
    return;
  end if;

  -- b) prijavljen uporabnik. auth.* ni povsod na voljo (npr. v preizkusni
  --    bazi ali pri vzdrževalnih poslih), zato poskus ne sme nikoli pasti.
  begin
    v_uid   := auth.uid();
    v_email := nullif(btrim(coalesce(auth.jwt() ->> 'email', '')), '');
  exception when others then
    v_uid := null; v_email := null;
  end;

  if v_uid is not null then
    select cm.role into v_role
    from public.company_members cm
    join public.companies co on co.id = cm.company_id
    where cm.user_id = v_uid
      and co."company_id" = p_company_code
    limit 1;

    return query select coalesce(v_email, v_uid::text), coalesce(v_role, 'staff');
    return;
  end if;

  -- c) servisni ključ, n8n, portal, uvoz
  return query select null::text, 'sistem'::text;
end;
$jp_akter$;

-- ───────────────────────────────────────────────────────────────────────────
-- 2) Zapis z varovalko proti podvajanju
--
-- Aplikacija ponekod isti dogodek zabeleži sama — zapisa 58 in 59 sta bila
-- identična, ker Calendar.tsx kliče dvakrat. Dokler ti klici ne izginejo, isti
-- dogodek za isto entiteto v kratkem oknu zapišemo samo enkrat.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.jp_zgodovina_zapisi(
  p_company    text,
  p_tip        text,
  p_entiteta   text,
  p_akcija     text,
  p_spremembe  jsonb,
  p_id_termina text,
  p_id_stranke text
)
returns void
language plpgsql
security definer
set search_path = public
as $jp_zapisi$
declare
  v_zdaj timestamp := (now() at time zone 'utc');
  v_kdo  text;
  v_tip  text;
begin
  if nullif(btrim(coalesce(p_company, '')), '') is null
     or nullif(btrim(coalesce(p_entiteta, '')), '') is null then
    return;
  end if;

  if exists (
    select 1
    from public.zgodovina z
    where z."ID podjetja" = p_company
      and z.tip_entitete  = p_tip
      and z."ID entitete" = p_entiteta
      and z.akcija        = p_akcija
      and z.created_at    > v_zdaj - interval '5 seconds'
  ) then
    return;
  end if;

  select a.izvedel, a.izvedel_tip
    into v_kdo, v_tip
  from public.jp_zgodovina_akter(p_company) a;

  insert into public.zgodovina
    ("ID podjetja", tip_entitete, "ID entitete", akcija, spremembe,
     izvedel, izvedel_tip, "ID termina", "ID stranke", created_at)
  values
    (p_company, p_tip, p_entiteta, p_akcija, p_spremembe,
     v_kdo, coalesce(v_tip, 'sistem'), p_id_termina, p_id_stranke, v_zdaj);
end;
$jp_zapisi$;

-- ───────────────────────────────────────────────────────────────────────────
-- 3) Termini
--
-- Sledimo le glavnim stolpcem. Če bi beležili vse, bi vsak poslan opomnik
-- ("Obveščen PRED", "Obvescen_PO") štel kot sprememba in zgodovino zasul.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.jp_zgodovina_termini()
returns trigger
language plpgsql
security definer
set search_path = public
as $jp_termini$
declare
  STOLPCI constant text[] := array[
    'Datum', 'Čas', 'Konec', 'Storitev', 'Oseba', 'Status',
    'Cena', 'Final cena', 'Opombe', 'Stranka', 'Plačano'
  ];
  v_company text;
  v_ent     text;
  v_stranka text;
  v_akcija  text;
  v_prej    jsonb := '{}'::jsonb;
  v_potem   jsonb := '{}'::jsonb;
  v_o       jsonb;
  v_n       jsonb;
  k         text;
  v_guc_tip text;
begin
  if TG_OP = 'DELETE' then
    perform public.jp_zgodovina_zapisi(
      OLD."ID podjetja", 'termin',
      coalesce(OLD."ID termina", OLD.id::text), 'izbrisan',
      null, coalesce(OLD."ID termina", OLD.id::text), OLD."ID stranke");
    return OLD;
  end if;

  v_company := NEW."ID podjetja";
  v_ent     := coalesce(NEW."ID termina", NEW.id::text);
  v_stranka := NEW."ID stranke";

  if TG_OP = 'INSERT' then
    v_guc_tip := nullif(btrim(coalesce(current_setting('jp.izvedel_tip', true), '')), '');
    perform public.jp_zgodovina_zapisi(
      v_company, 'termin', v_ent,
      case when v_guc_tip = 'stranka' then 'online_rezervacija' else 'ustvarjen' end,
      null, v_ent, v_stranka);
    return NEW;
  end if;

  -- Mehki izbris je UPDATE, ne DELETE — aplikacija briše tako.
  if OLD.deleted_at is null and NEW.deleted_at is not null then
    perform public.jp_zgodovina_zapisi(
      v_company, 'termin', v_ent, 'izbrisan', null, v_ent, v_stranka);
    return NEW;
  end if;

  v_o := to_jsonb(OLD);
  v_n := to_jsonb(NEW);

  foreach k in array STOLPCI loop
    if (v_o -> k) is distinct from (v_n -> k) then
      v_prej  := v_prej  || jsonb_build_object(k, v_o -> k);
      v_potem := v_potem || jsonb_build_object(k, v_n -> k);
    end if;
  end loop;

  if v_prej = '{}'::jsonb then
    return NEW;   -- spremenilo se je le kaj, česar ne sledimo
  end if;

  if (v_o ->> 'Status') is distinct from (v_n ->> 'Status')
     and (v_n ->> 'Status') = 'cancelled' then
    v_akcija := 'odpovedan';
  elsif (v_o ->> 'Status') is distinct from (v_n ->> 'Status')
     and (v_n ->> 'Status') = 'completed' then
    v_akcija := 'zakljucen';
  elsif (v_o ->> 'Datum') is distinct from (v_n ->> 'Datum')
     or  (v_o ->> 'Čas')   is distinct from (v_n ->> 'Čas')
     or  (v_o ->> 'Konec') is distinct from (v_n ->> 'Konec') then
    v_akcija := 'prestavljen';
  else
    v_akcija := 'spremenjen';
  end if;

  perform public.jp_zgodovina_zapisi(
    v_company, 'termin', v_ent, v_akcija,
    jsonb_build_object('prej', v_prej, 'potem', v_potem),
    v_ent, v_stranka);

  return NEW;

-- Beleženje ne sme nikoli podreti glavnega zapisa: termin se mora shraniti
-- tudi, če zgodovina iz kateregakoli razloga odpove.
exception when others then
  return coalesce(NEW, OLD);
end;
$jp_termini$;

-- ───────────────────────────────────────────────────────────────────────────
-- 4) Stranke
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.jp_zgodovina_stranke()
returns trigger
language plpgsql
security definer
set search_path = public
as $jp_stranke$
declare
  STOLPCI constant text[] := array[
    'Ime', 'Priimek', 'Email stranke', 'Telefonska številka', 'Status',
    'Opombe stranke', 'Spol', 'Obvestimo', 'marketing_consent'
  ];
  v_company text;
  v_ent     text;
  v_prej    jsonb := '{}'::jsonb;
  v_potem   jsonb := '{}'::jsonb;
  v_o       jsonb;
  v_n       jsonb;
  k         text;
begin
  if TG_OP = 'INSERT' then
    perform public.jp_zgodovina_zapisi(
      NEW."ID Podjetja", 'stranka',
      coalesce(NEW."ID stranke", NEW.id::text), 'stranka_dodana',
      null, null, coalesce(NEW."ID stranke", NEW.id::text));
    return NEW;
  end if;

  v_company := NEW."ID Podjetja";
  v_ent     := coalesce(NEW."ID stranke", NEW.id::text);

  v_o := to_jsonb(OLD);
  v_n := to_jsonb(NEW);

  foreach k in array STOLPCI loop
    if (v_o -> k) is distinct from (v_n -> k) then
      v_prej  := v_prej  || jsonb_build_object(k, v_o -> k);
      v_potem := v_potem || jsonb_build_object(k, v_n -> k);
    end if;
  end loop;

  if v_prej = '{}'::jsonb then
    return NEW;
  end if;

  perform public.jp_zgodovina_zapisi(
    v_company, 'stranka', v_ent, 'stranka_posodobljena',
    jsonb_build_object('prej', v_prej, 'potem', v_potem),
    null, v_ent);

  return NEW;

exception when others then
  return coalesce(NEW, OLD);
end;
$jp_stranke$;

-- ───────────────────────────────────────────────────────────────────────────
-- 5) Pripni sprožilce
-- ───────────────────────────────────────────────────────────────────────────
drop trigger if exists jp_zgodovina_termini_t on public."Termini";
create trigger jp_zgodovina_termini_t
  after insert or update or delete on public."Termini"
  for each row execute function public.jp_zgodovina_termini();

drop trigger if exists jp_zgodovina_stranke_t on public."Stranke";
create trigger jp_zgodovina_stranke_t
  after insert or update on public."Stranke"
  for each row execute function public.jp_zgodovina_stranke();

-- ───────────────────────────────────────────────────────────────────────────
-- 6) Indeksa
--
-- Varovalka proti podvajanju poišče zadnji enak dogodek ob vsakem zapisu v
-- "Termini" in "Stranke", zato mora biti to poceni tudi, ko zgodovina zraste.
-- Drugi indeks je za samo stran, ki bere po podjetju in po času navzdol.
-- ───────────────────────────────────────────────────────────────────────────
create index if not exists zgodovina_dedup_idx
  on public.zgodovina ("ID podjetja", "ID entitete", akcija, created_at desc);

create index if not exists zgodovina_podjetje_cas_idx
  on public.zgodovina ("ID podjetja", created_at desc);

grant execute on function public.jp_zgodovina_akter(text) to authenticated, service_role;
