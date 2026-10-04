-- Receptionist+: opozorilo, ko kreditov zmanjka.
--
-- V nastavitvah se prag da nastaviti in se shrani, a ga ni bral nihče — ne
-- aplikacija, ne noben tok. Posledica je bila vidna v produkciji: dva klica sta
-- končala z izidom `no_credits`, torej je nekdo poklical, asistent pa se ni
-- oglasil, in podjetje o tem ni izvedelo.
--
-- Opozorilo gre v bazo in ne v načrtovan tok, ker kredite odšteva zunanji
-- projekt Receptionista: sprožilec ujame vsak odpis takoj, ne glede na to, kdo
-- piše, in ni treba ničesar poizvedovati vsakih nekaj minut.
--
-- Obvestimo le ob PREHODU čez mejo, ne ob vsakem odpisu pod njo — sicer bi
-- podjetje pri vsakem klicu dobilo novo opozorilo. Ko se stanje spet napolni
-- nad prag, se oznaka pobriše in naslednji padec spet opozori.
--
-- Uporabimo obstoječi vrsti obvestil `limit_near` in `limit_reached`; enum ju
-- že pozna, zato nove vrednosti niso potrebne.
--
-- dedupe_key je zato edinstven do mikrosekunde: pred podvajanjem varuje logika
-- prehoda, ne ključ. Ko je bil ključ natančen le do minute, je dokup in takojšen
-- ponoven padec znotraj iste minute drugo opozorilo tiho požrl.

alter table public.receptionist_credits
  add column if not exists low_balance_notified_at timestamptz;

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
  elsif OLD.balance_credits >= v_prag then
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
