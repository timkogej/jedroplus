-- Asistent+ osebni opomniki (docs/glasovni-asistent-dodatne-funkcije-nacrt.md, §5)
--
-- »Opomni me jutri ob devetih, da pokličem dobavitelja.« / »Ko pride Ana, me opomni …«
--
-- * Opomnik je vedno samo za uporabnika, ki ga je ustvaril (RLS: vidi samo svoje).
-- * Piše samo strežnik po potrditvi uporabnika (service role); uporabnik ne more pisati.
-- * Dostava: jp_glas_opomniki_tek() vsako minuto (pg_cron) vstavi zapis v notifications
--   (prejemnik = uporabnik) → obstoječi sprožilec pošlje push na njegove naprave.
-- * Vezan na termin: čas = začetek termina v pasu podjetja; prestavljen termin premakne
--   opomnik, odpovedan ali izbrisan ga prekliče (in o tem obvesti).
--
-- PRED ZAGONOM: v Supabase → Database → Extensions vklopi pg_cron. Brez njega se tabela in
-- funkcije ustvarijo, opomniki pa se ne pošiljajo (na koncu je opozorilo).

create table if not exists public.glas_opomniki (
  id           uuid primary key default gen_random_uuid(),
  company_id   text not null,
  company_uuid uuid not null,
  user_id      uuid not null,
  besedilo     text not null check (char_length(besedilo) between 1 and 300),
  ob           timestamptz,
  id_termina   text,
  id_stranke   text,
  casovni_pas  text not null default 'Europe/Ljubljana',
  jezik        text not null default 'sl' check (jezik in ('sl', 'en', 'de', 'it', 'hr')),
  stanje       text not null default 'caka' check (stanje in ('caka', 'poslano', 'preklican', 'potekel')),
  obvestilo_id uuid,
  ukaz_id      uuid,
  created_at   timestamptz not null default now(),
  poslano_at   timestamptz,
  check (ob is not null or id_termina is not null)
);

create index if not exists glas_opomniki_dospeli on public.glas_opomniki (ob) where stanje = 'caka';
create index if not exists glas_opomniki_uporabnik on public.glas_opomniki (user_id, company_id, stanje);

alter table public.glas_opomniki enable row level security;
drop policy if exists glas_opomniki_svoji on public.glas_opomniki;
create policy glas_opomniki_svoji on public.glas_opomniki for select to authenticated
  using (user_id = auth.uid() and public.jp_ima_pravico_clana(company_id, 'glas.uporaba'));
revoke insert, update, delete on public.glas_opomniki from anon, authenticated;

-- Doda opomnik (po potrditvi). Največ p_najvec čakajočih na uporabnika v podjetju.
create or replace function public.jp_glas_dodaj_opomnik(
  p_company text, p_company_uuid uuid, p_user uuid, p_besedilo text, p_ob timestamptz,
  p_termin text, p_stranka text, p_pas text, p_jezik text, p_ukaz uuid, p_najvec integer)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_n  integer;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('glas_opomniki:' || p_user::text));
  select count(*) into v_n from public.glas_opomniki
   where user_id = p_user and company_id = p_company and stanje = 'caka';
  if v_n >= p_najvec then
    return jsonb_build_object('ok', false, 'koda', 'omejitev', 'cakajocih', v_n);
  end if;
  insert into public.glas_opomniki (company_id, company_uuid, user_id, besedilo, ob, id_termina, id_stranke, casovni_pas, jezik, ukaz_id)
  values (p_company, p_company_uuid, p_user, p_besedilo, p_ob, p_termin, p_stranka, coalesce(p_pas, 'Europe/Ljubljana'), coalesce(p_jezik, 'sl'), p_ukaz)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- Prekliče SVOJ čakajoči opomnik. Vrne true, če je bil preklican.
create or replace function public.jp_glas_preklici_opomnik(p_id uuid, p_company text, p_user uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  update public.glas_opomniki set stanje = 'preklican'
   where id = p_id and company_id = p_company and user_id = p_user and stanje = 'caka';
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

-- Naslov obvestila v jeziku asistenta.
create or replace function public.jp_glas_naslov_opomnika(p_jezik text)
returns text language sql immutable as $$
  select case p_jezik when 'en' then 'Reminder' when 'de' then 'Erinnerung' when 'it' then 'Promemoria' when 'hr' then 'Podsjetnik' else 'Opomnik' end;
$$;

-- Tek (vsako minuto). Varen za vzporedne teke (for update skip locked, dedupe_key).
create or replace function public.jp_glas_opomniki_tek()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  r        record;
  v_ob     timestamptz;
  v_t      record;
  v_obv    uuid;
  v_poslanih integer := 0;
  v_telo   text;
begin
  -- 1. Vezani na termin: čas iz termina (prestavljen → nov čas); odpovedan/izbrisan → preklican.
  for r in
    select * from public.glas_opomniki
     where stanje = 'caka' and id_termina is not null
     for update skip locked
  loop
    select t."Datum", t."Čas", t."Status", t.deleted_at into v_t
      from public."Termini" t
     where t."ID termina" = r.id_termina and t."ID podjetja" = r.company_id
     limit 1;
    if not found or v_t.deleted_at is not null or lower(coalesce(v_t."Status"::text, '')) ~ '(cancel|odpoved|preklic)' then
      update public.glas_opomniki set stanje = 'preklican' where id = r.id;
      if exists (select 1 from public.company_members m where m.company_id = r.company_uuid and m.user_id = r.user_id) then
        v_telo := case r.jezik
          when 'en' then 'The appointment was cancelled: '
          when 'de' then 'Der Termin wurde abgesagt: '
          when 'it' then 'L''appuntamento è stato annullato: '
          when 'hr' then 'Termin je otkazan: '
          else 'Termin je odpovedan: ' end || r.besedilo;
        insert into public.notifications (company_id, recipient_user_id, type, severity, title, body, entity_type, entity_id, dedupe_key)
        values (r.company_uuid, r.user_id, 'system', 'info', public.jp_glas_naslov_opomnika(r.jezik), left(v_telo, 400),
                'glas_opomnik', r.id::text, 'glas_opomnik_preklic_' || r.id::text)
        on conflict do nothing;
      end if;
      continue;
    end if;
    begin
      v_ob := ((left(v_t."Datum"::text, 10))::date + (left(v_t."Čas"::text, 5))::time) at time zone r.casovni_pas;
    exception when others then
      continue; -- nečitljiv datum/čas: pusti, kot je
    end;
    if r.ob is distinct from v_ob then
      update public.glas_opomniki set ob = v_ob where id = r.id;
    end if;
  end loop;

  -- 2. Dospeli: obvestilo prejemniku (push prek obstoječega sprožilca).
  for r in
    select * from public.glas_opomniki
     where stanje = 'caka' and ob <= now()
     order by ob
     limit 500
     for update skip locked
  loop
    if r.ob < now() - interval '24 hours' then
      update public.glas_opomniki set stanje = 'potekel' where id = r.id;
      continue;
    end if;
    if not exists (select 1 from public.company_members m where m.company_id = r.company_uuid and m.user_id = r.user_id) then
      update public.glas_opomniki set stanje = 'preklican' where id = r.id;
      continue;
    end if;
    v_telo := r.besedilo || case when r.ob < now() - interval '5 minutes' then
      case r.jezik when 'en' then ' (late)' when 'de' then ' (verspätet)' when 'it' then ' (in ritardo)' when 'hr' then ' (kašnjenje)' else ' (zamuda)' end
      else '' end;
    v_obv := null;
    insert into public.notifications (company_id, recipient_user_id, type, severity, title, body, entity_type, entity_id, dedupe_key)
    values (r.company_uuid, r.user_id, 'system', 'info', public.jp_glas_naslov_opomnika(r.jezik), left(v_telo, 400),
            'glas_opomnik', r.id::text, 'glas_opomnik_' || r.id::text)
    on conflict do nothing
    returning id into v_obv;
    update public.glas_opomniki set stanje = 'poslano', poslano_at = now(), obvestilo_id = v_obv where id = r.id;
    v_poslanih := v_poslanih + 1;
  end loop;
  return v_poslanih;
end;
$$;

revoke all on function public.jp_glas_dodaj_opomnik(text, uuid, uuid, text, timestamptz, text, text, text, text, uuid, integer) from public, anon, authenticated;
revoke all on function public.jp_glas_preklici_opomnik(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.jp_glas_opomniki_tek() from public, anon, authenticated;
grant execute on function public.jp_glas_dodaj_opomnik(text, uuid, uuid, text, timestamptz, text, text, text, text, uuid, integer) to service_role;
grant execute on function public.jp_glas_preklici_opomnik(uuid, text, uuid) to service_role;
grant execute on function public.jp_glas_opomniki_tek() to service_role;

-- Nadzor: čakajoči, ki bi morali biti že poslani (pg_cron ne teče?). Samo service role.
create or replace view public.glas_opomniki_zamuda as
  select id, company_id, ob, now() - ob as zamuda
    from public.glas_opomniki
   where stanje = 'caka' and ob < now() - interval '5 minutes';
revoke all on public.glas_opomniki_zamuda from anon, authenticated;

-- pg_cron: vsako minuto. Če razširitev ni vklopljena, samo opozori.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'glas-opomniki';
    perform cron.schedule('glas-opomniki', '* * * * *', 'select public.jp_glas_opomniki_tek()');
  else
    raise warning 'pg_cron ni vklopljen: opomniki se ne bodo pošiljali. Vklopi razširitev in znova poženi to datoteko.';
  end if;
end $$;
