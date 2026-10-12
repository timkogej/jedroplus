-- Opozorilo, ko sporočilo stranki ni bilo poslano.
--
-- Doslej je sporočilo lahko padlo in nihče ni izvedel: pošiljanje se ne sesuje,
-- samo zapiše `failed` in gre naprej. Lovilec napak v n8n tega ne ujame, ker
-- tok uspešno konča. Stranka torej ni dobila opomnika, salon pa je to ugotovil
-- šele, ko se ni pojavila — če sploh.
--
-- Sprožilec je na `message_outbox` in ne v načrtovanem toku, ker stanje
-- postavlja osem različnih vozlišč v šestih tokovih. Tako jih ujamemo vse
-- naenkrat in noben nov tok tega ne more pozabiti.
--
-- Opozarjamo SAMO na sveža sporočila (24 ur). Starih se namenoma ne dotikamo:
-- večina jih je iz okvare konec septembra, termini so zdavnaj mimo in
-- obveščanje o njih bi bilo samo hrup.
--
-- Nič se ne pošilja in nič ne poskuša znova — podjetje samo izve, da stranka
-- sporočila ni dobila, in lahko pokliče.

create or replace function public.jp_opozori_neposlano()
returns trigger
language plpgsql
security definer
set search_path = public
as $jp_neposlano$
declare
  v_ime       text;
  v_vrsta     text;
  v_kanal     text;
  v_telo      text;
  v_prejemnik record;
  v_termin_id bigint;
  v_predpona  text;
begin
  -- Samo ob prehodu v `failed`; ponovni zapis istega stanja ne opozarja znova.
  if NEW.status is distinct from 'failed' then
    return NEW;
  end if;
  if TG_OP = 'UPDATE' and OLD.status is not distinct from 'failed' then
    return NEW;
  end if;

  -- Staro sporočilo, ki se ga je kdo dotaknil, ni razlog za opozorilo.
  if NEW.created_at < now() - interval '24 hours' then
    return NEW;
  end if;

  if NEW.company_id is null then
    return NEW;
  end if;

  -- Ime stranke: entity_id je oblike "<id termina>:<VRSTA>". Pri sporočilih iz
  -- Komunikacije predpona ni številka, zato pretvorbo poskusimo le takrat, ko
  -- res gre za števec — sicer bi napaka pretvorbe požrla celotno opozorilo.
  v_predpona := split_part(coalesce(NEW.entity_id, ''), ':', 1);
  if v_predpona ~ '^\d+$' then
    v_termin_id := v_predpona::bigint;
  end if;
  if v_termin_id is not null then
    select t."Stranka" into v_ime
    from public."Termini" t
    where t.id = v_termin_id
    limit 1;
  end if;

  v_vrsta := case NEW.type
               when 'APPT_REMINDER'   then 'opomnik pred terminom'
               when 'APPT_CONFIRM'    then 'potrdilo o terminu'
               when 'APPT_PO'         then 'sporočilo po terminu'
               when 'APPT_RESCHEDULE' then 'obvestilo o prestavitvi'
               when 'MESSAGE'         then 'sporočilo iz Komunikacije'
               else coalesce(NEW.type, 'sporočilo')
             end;

  v_kanal := case lower(coalesce(NEW.channel, '')) when 'sms' then 'SMS' else 'e-pošta' end;

  -- Stavek je namenoma brez ujemanja po spolu: "sporočilo", "opomnik" in
  -- "potrdilo" imajo tri različne spole in bi sicer vsak zahteval svojo obliko.
  v_telo := 'Ni poslano: ' || v_kanal || ', ' || v_vrsta
            || coalesce(', stranka ' || nullif(btrim(v_ime), ''), '')
            || coalesce(' (' || nullif(btrim(NEW."to"), '') || ')', '')
            || '. Stranka sporočila ni prejela — po potrebi jo pokličite.';

  for v_prejemnik in
    select cm.user_id
    from public.company_members cm
    where cm.company_id = NEW.company_id
      and lower(cm.role) in ('owner', 'admin')
  loop
    insert into public.notifications
      (company_id, recipient_user_id, type, severity, title, body,
       action_url, entity_type, entity_id, dedupe_key)
    values
      (NEW.company_id, v_prejemnik.user_id, 'system', 'error',
       'Sporočilo stranki ni bilo poslano', v_telo,
       '/komunikacija', 'message_outbox', NEW.id::text,
       'neposlano_' || NEW.id::text || '_' || v_prejemnik.user_id::text)
    on conflict do nothing;
  end loop;

  return NEW;

-- Opozorilo ne sme nikoli preprečiti zapisa stanja: če tu kaj odpove, se
-- sporočilo vseeno pravilno označi za neuspelo.
exception when others then
  return NEW;
end;
$jp_neposlano$;

drop trigger if exists jp_opozori_neposlano_t on public.message_outbox;
create trigger jp_opozori_neposlano_t
  after insert or update of status on public.message_outbox
  for each row execute function public.jp_opozori_neposlano();
