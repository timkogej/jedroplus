-- Receptionist+: opozorilo o malo kreditih je prihajalo po VSAKEM klicu.
--
-- Od 17. 10. 2026 je lastnik po vsakem klicu dobil "Receptionist+ ima malo
-- kreditov — stanje je padlo na 298.56 kreditov (vaš prag je 60.00)", čeprav je
-- bilo stanje daleč nad pragom. Funkcija v bazi se ni ujemala z
-- 1790800000_receptionist_nizko_stanje.sql (ta ob stanju nad pragom ne obvešča),
-- zato jo tu znova ustvarimo, s pogojem prehoda izpisanim v celoti:
-- obvestimo samo, ko je bilo stanje PRED odpisom na ali nad pragom in je PO
-- odpisu pod njim.
--
-- Napačna opozorila, ki so že nastala, označimo kot prebrana in arhivirana.
--
-- Run manually via the Supabase SQL editor.

create or replace function public.jp_receptionist_nizko_stanje()
returns trigger
language plpgsql
security definer
set search_path = public
as $jp_recept$
declare
  v_prag      numeric;
  v_omogocen  boolean;
  v_podjetje  uuid;
  v_ime       text;
  v_naslov    text;
  v_telo      text;
  v_vrsta     public.notification_type;
  v_stopnja   public.notification_severity;
  v_kljuc     text;
  v_prejemnik record;
begin
  -- Zanima nas le padec; polnjenje obravnavamo posebej spodaj.
  if NEW.balance_credits is not distinct from OLD.balance_credits then
    return NEW;
  end if;

  select s.low_balance_threshold, s.enabled
    into v_prag, v_omogocen
  from public.receptionist_settings s
  where s.company_slug = NEW.company_slug
  limit 1;

  if not coalesce(v_omogocen, false) then
    return NEW;          -- asistent je izklopljen, opozorilo nima smisla
  end if;

  v_prag := coalesce(v_prag, 60);

  -- Napolnjeno nazaj nad prag: pobriši oznako, da naslednji padec spet opozori.
  if NEW.balance_credits >= v_prag then
    if NEW.low_balance_notified_at is not null then
      update public.receptionist_credits
         set low_balance_notified_at = null
       where company_slug = NEW.company_slug;
    end if;
    return NEW;
  end if;

  -- Prazno je hujše od malo: opozori znova, tudi če smo že opozorili na prag.
  if NEW.balance_credits <= 0 and OLD.balance_credits > 0 then
    v_vrsta   := 'limit_reached';
    v_stopnja := 'error';
    v_naslov  := 'Receptionist+ je ostal brez kreditov';
    v_telo    := 'Asistent se na klice ne bo več oglašal, dokler ne dokupite kreditov.';
    v_kljuc   := 'recept_brez_kreditov';
  elsif OLD.balance_credits >= v_prag and NEW.balance_credits < v_prag then
    v_vrsta   := 'limit_near';
    v_stopnja := 'warning';
    v_naslov  := 'Receptionist+ ima malo kreditov';
    v_telo    := 'Stanje je padlo na ' || round(NEW.balance_credits, 2)
                 || ' kreditov (vaš prag je ' || round(v_prag, 2) || ').';
    v_kljuc   := 'recept_nizko_stanje';
  else
    return NEW;          -- že pod pragom, o tem smo že obvestili
  end if;

  select c.id, c.name into v_podjetje, v_ime
  from public.companies c
  where c.slug = NEW.company_slug
  limit 1;

  if v_podjetje is null then
    return NEW;
  end if;

  -- Obvestimo lastnike in administratorje; osebje kreditov ne kupuje.
  for v_prejemnik in
    select cm.user_id
    from public.company_members cm
    where cm.company_id = v_podjetje
      and lower(cm.role) in ('owner', 'admin')
  loop
    insert into public.notifications
      (company_id, recipient_user_id, type, severity, title, body,
       action_url, entity_type, entity_id, dedupe_key)
    values
      (v_podjetje, v_prejemnik.user_id, v_vrsta, v_stopnja, v_naslov, v_telo,
       '/receptionist-plus', 'receptionist', NEW.company_slug,
       v_kljuc || '_' || NEW.company_slug || '_' || v_prejemnik.user_id::text
                || '_' || to_char(clock_timestamp() at time zone 'utc', 'YYYYMMDDHH24MISSUS'))
    on conflict do nothing;
  end loop;

  update public.receptionist_credits
     set low_balance_notified_at = now()
   where company_slug = NEW.company_slug;

  return NEW;

-- Opozorilo ne sme nikoli preprečiti odpisa kreditov: če tu kaj odpove, se
-- klic vseeno pravilno zaračuna.
exception when others then
  return NEW;
end;
$jp_recept$;

drop trigger if exists jp_receptionist_nizko_stanje_t on public.receptionist_credits;
create trigger jp_receptionist_nizko_stanje_t
  after update on public.receptionist_credits
  for each row execute function public.jp_receptionist_nizko_stanje();

update public.notifications
   set is_read = true, read_at = coalesce(read_at, now()),
       is_archived = true, archived_at = coalesce(archived_at, now())
 where type = 'limit_near'
   and entity_type = 'receptionist'
   and title = 'Receptionist+ ima malo kreditov'
   and created_at >= '2026-10-01'
   and (regexp_match(body, 'padlo na ([0-9.]+) kreditov \(vaš prag je ([0-9.]+)\)'))[1]::numeric
       >= (regexp_match(body, 'padlo na ([0-9.]+) kreditov \(vaš prag je ([0-9.]+)\)'))[2]::numeric;

-- Stanje "že opozorjeno" naj odraža resnico: nad pragom ni opozorila.
update public.receptionist_credits c
   set low_balance_notified_at = null
  from public.receptionist_settings s
 where s.company_slug = c.company_slug
   and c.balance_credits >= coalesce(s.low_balance_threshold, 60)
   and c.low_balance_notified_at is not null;

-- Preverba (izpiše se v SQL editorju): na receptionist_credits mora biti en sam
-- sprožilec, jp_receptionist_nizko_stanje_t → jp_receptionist_nizko_stanje.
select tgname as sprozilec, tgfoid::regproc as funkcija
  from pg_trigger
 where tgrelid = 'public.receptionist_credits'::regclass
   and not tgisinternal;
