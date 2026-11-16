-- 1793500000_glasovni_asistent.sql
--
-- Osnova za glasovnega asistenta (Asistent+). Načrt: docs/glasovni-asistent-nacrt.md
--
-- Kaj doda:
--   glas_nastavitve_podjetja    stikalo (feature flag), mesečna kvota, hramba prepisov
--   glas_nastavitve_uporabnika  lastnik/admin izklopi glas posameznemu članu
--   glas_ukazi                  en vrstica na ukaz: izid, stroški, trajanja (prepis se po roku izbriše)
--   glas_predlogi               predlogi dejanj, ki čakajo na potrditev (enkratni žeton, potek)
--   glas_poraba_mesec           števec ukazov in stroškov po podjetju in mesecu
--   glas_revizija               revizijska sled (brez osebnih podatkov v čistem besedilu)
--   stranke_zapiski             zapiski na kartici stranke (samo dodajanje)
--
-- Pravila:
--   * Ledger tabele (ukazi, predlogi, poraba, revizija) piše samo strežnik (service role)
--     prek spodnjih funkcij. Člani jih lahko le berejo (RLS).
--   * stranke_zapiski piše član z lastno sejo; RLS preveri članstvo IN pravico
--     (staff_role_permissions), ki je obstoječe poti preverjajo samo v vmesniku.
--   * Nič se ne briše razen prepisov po roku hrambe.
--
-- Migracija je idempotentna (lahko se zažene večkrat). Ne spreminja obstoječih tabel.

-- ───────────────────────────────────────────────────────────────────────────
-- Pravice člana (splošno, ne samo za glas)
-- ───────────────────────────────────────────────────────────────────────────
-- owner/admin: vse. staff: po staff_role_permissions; če vrstice ni, velja isto kot
-- v vmesniku (ClientsClient: `permissions?.can_edit_clients ?? true`) — razen za
-- glas, kjer brez vrstice velja NE (strožje).
create or replace function public.jp_ima_pravico_clana(p_company text, p_pravica text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.company_members m
    join public.companies c on c.id = m.company_id
    left join public.staff_role_permissions p on p.company_id = c.id
    where c.company_id = p_company
      and m.user_id = auth.uid()
      and (
        m.role in ('owner', 'admin')
        or (m.role = 'staff' and case p_pravica
              when 'glas.uporaba'        then coalesce(p.can_access_asistent_plus, false)
              when 'stranke.branje'      then coalesce(p.can_view_clients, true)
              when 'stranke.urejanje'    then coalesce(p.can_edit_clients, true)
              when 'stranke.ustvarjanje' then coalesce(p.can_create_clients, true)
              when 'termini.branje'      then coalesce(p.can_view_all_appointments, true)
                                              or coalesce(p.can_view_only_own_appointments, false)
              when 'termini.urejanje'    then coalesce(p.can_edit_all_appointments, true)
                                              or coalesce(p.can_edit_only_own_appointments, false)
              when 'termini.ustvarjanje' then coalesce(p.can_create_appointments, true)
              else false
            end)
      )
  );
$$;

revoke all on function public.jp_ima_pravico_clana(text, text) from public;
grant execute on function public.jp_ima_pravico_clana(text, text) to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- Nastavitve
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.glas_nastavitve_podjetja (
  company_id            text primary key,                      -- companies.company_id
  vklopljeno            boolean not null default false,        -- feature flag
  mesecna_kvota         integer not null default 400 check (mesecna_kvota >= 0),
  ukazov_na_minuto      integer not null default 10 check (ukazov_na_minuto between 1 and 60),
  tts_vklopljen         boolean not null default false,
  hramba_prepisov_dni   integer not null default 30 check (hramba_prepisov_dni between 0 and 365),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table if not exists public.glas_nastavitve_uporabnika (
  company_id   text not null,
  user_id      uuid not null,
  vklopljeno   boolean not null default true,
  spremenil    uuid,
  updated_at   timestamptz not null default now(),
  primary key (company_id, user_id)
);

-- ───────────────────────────────────────────────────────────────────────────
-- Ukazi, predlogi, poraba, revizija
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.glas_ukazi (
  id                     uuid primary key default gen_random_uuid(),
  company_id             text not null,
  user_id                uuid not null,
  vhod                   text not null check (vhod in ('aplikacija', 'telefon', 'besedilo')),
  status                 text not null default 'v_teku'
                         check (status in ('v_teku', 'odgovor', 'predlog', 'vprasanje', 'napaka')),
  prepis                 text,
  odgovor                text,
  orodja                 text[] not null default '{}',
  napaka_koda            text,
  stt_ponudnik           text,
  stt_sekunde            numeric(8, 2) not null default 0,
  llm_ponudnik           text,
  llm_model              text,
  llm_vhod               integer not null default 0,
  llm_vhod_predpomnjen   integer not null default 0,
  llm_izhod              integer not null default 0,
  tts_znaki              integer not null default 0,
  strosek_mikro_usd      numeric(14, 3) not null default 0,   -- 1 = 0,000001 USD
  trajanje_ms            jsonb not null default '{}'::jsonb,
  steje_v_kvoto          boolean not null default true,
  created_at             timestamptz not null default now(),
  zakljucen_at           timestamptz
);
create index if not exists glas_ukazi_podjetje_cas on public.glas_ukazi (company_id, created_at desc);
create index if not exists glas_ukazi_uporabnik_cas on public.glas_ukazi (user_id, created_at desc);

create table if not exists public.glas_predlogi (
  id                uuid primary key default gen_random_uuid(),
  company_id        text not null,
  user_id           uuid not null,
  ukaz_id           uuid references public.glas_ukazi (id) on delete set null,
  orodje            text not null,
  razred            text not null check (razred in ('pisanje', 'mnozicno', 'sporocila')),
  parametri         jsonb not null,
  parametri_hash    text not null,
  zeton_hash        text not null,
  povzetek          text not null,
  status            text not null default 'caka'
                    check (status in ('caka', 'izvaja', 'izvedeno', 'napaka', 'zavrnjeno', 'poteklo')),
  potece            timestamptz not null,
  rezultat          jsonb,
  napaka            text,
  created_at        timestamptz not null default now(),
  zacetek_izvedbe   timestamptz,
  zakljuceno_at     timestamptz
);
create index if not exists glas_predlogi_uporabnik on public.glas_predlogi (user_id, created_at desc);

create table if not exists public.glas_poraba_mesec (
  company_id             text not null,
  mesec                  date not null,                       -- prvi dan meseca (Europe/Ljubljana)
  ukazi                  integer not null default 0,
  stt_sekunde            numeric(12, 2) not null default 0,
  llm_vhod               bigint not null default 0,
  llm_vhod_predpomnjen   bigint not null default 0,
  llm_izhod              bigint not null default 0,
  tts_znaki              bigint not null default 0,
  strosek_mikro_usd      numeric(16, 3) not null default 0,
  updated_at             timestamptz not null default now(),
  primary key (company_id, mesec)
);

create table if not exists public.glas_revizija (
  id            bigint generated always as identity primary key,
  company_id    text not null,
  user_id       uuid,
  ukaz_id       uuid,
  predlog_id    uuid,
  dogodek       text not null,          -- ukaz, predlog, potrjeno, izvedeno, napaka, zavrnjeno, ni_pravice, kvota
  orodje        text,
  podrobnosti   jsonb not null default '{}'::jsonb,   -- samo ID-ji in kode, nikoli imena/telefoni
  created_at    timestamptz not null default now()
);
create index if not exists glas_revizija_podjetje_cas on public.glas_revizija (company_id, created_at desc);

-- ───────────────────────────────────────────────────────────────────────────
-- Zapiski na kartici stranke
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.stranke_zapiski (
  id               uuid primary key default gen_random_uuid(),
  "ID podjetja"    text not null,
  "ID stranke"     text not null,
  kategorija       text not null check (kategorija in ('barva', 'preferenca', 'opomba')),
  besedilo         text not null check (char_length(besedilo) between 1 and 2000),
  podrobnosti      jsonb not null default '{}'::jsonb,   -- npr. {"odtenki":["6.3","7.1"],"gramov":30,"oksidant_pct":6,"cas_min":35}
  vir              text not null default 'rocno' check (vir in ('glas', 'rocno')),
  ukaz_id          uuid,
  avtor_user_id    uuid not null default auth.uid(),
  avtor_ime        text,
  created_at       timestamptz not null default now()
);
create index if not exists stranke_zapiski_stranka
  on public.stranke_zapiski ("ID podjetja", "ID stranke", created_at desc);

-- ───────────────────────────────────────────────────────────────────────────
-- RLS
-- ───────────────────────────────────────────────────────────────────────────
alter table public.glas_nastavitve_podjetja  enable row level security;
alter table public.glas_nastavitve_uporabnika enable row level security;
alter table public.glas_ukazi                enable row level security;
alter table public.glas_predlogi             enable row level security;
alter table public.glas_poraba_mesec         enable row level security;
alter table public.glas_revizija             enable row level security;
alter table public.stranke_zapiski           enable row level security;

-- Pomožna: ali je klicatelj owner/admin podjetja (besedilni ID)
create or replace function public.jp_je_skrbnik_podjetja(p_company text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.company_members m
    join public.companies c on c.id = m.company_id
    where c.company_id = p_company and m.user_id = auth.uid() and m.role in ('owner', 'admin')
  );
$$;
revoke all on function public.jp_je_skrbnik_podjetja(text) from public;
grant execute on function public.jp_je_skrbnik_podjetja(text) to authenticated;

drop policy if exists glas_np_branje on public.glas_nastavitve_podjetja;
create policy glas_np_branje on public.glas_nastavitve_podjetja
  for select to authenticated using (public.jp_je_clan_podjetja(company_id));

drop policy if exists glas_nu_branje on public.glas_nastavitve_uporabnika;
create policy glas_nu_branje on public.glas_nastavitve_uporabnika
  for select to authenticated
  using (user_id = auth.uid() or public.jp_je_skrbnik_podjetja(company_id));
drop policy if exists glas_nu_pisanje on public.glas_nastavitve_uporabnika;
create policy glas_nu_pisanje on public.glas_nastavitve_uporabnika
  for all to authenticated
  using (public.jp_je_skrbnik_podjetja(company_id))
  with check (public.jp_je_skrbnik_podjetja(company_id));

drop policy if exists glas_ukazi_branje on public.glas_ukazi;
create policy glas_ukazi_branje on public.glas_ukazi
  for select to authenticated
  using ((user_id = auth.uid() and public.jp_je_clan_podjetja(company_id))
         or public.jp_je_skrbnik_podjetja(company_id));

drop policy if exists glas_predlogi_branje on public.glas_predlogi;
create policy glas_predlogi_branje on public.glas_predlogi
  for select to authenticated
  using (user_id = auth.uid() and public.jp_je_clan_podjetja(company_id));

drop policy if exists glas_poraba_branje on public.glas_poraba_mesec;
create policy glas_poraba_branje on public.glas_poraba_mesec
  for select to authenticated using (public.jp_je_clan_podjetja(company_id));

drop policy if exists glas_revizija_branje on public.glas_revizija;
create policy glas_revizija_branje on public.glas_revizija
  for select to authenticated using (public.jp_je_skrbnik_podjetja(company_id));

drop policy if exists stranke_zapiski_branje on public.stranke_zapiski;
create policy stranke_zapiski_branje on public.stranke_zapiski
  for select to authenticated
  using (public.jp_ima_pravico_clana("ID podjetja", 'stranke.branje'));

-- Vstavi lahko le član s pravico urejanja strank, kot sebe, za stranko svojega podjetja.
drop policy if exists stranke_zapiski_vstavljanje on public.stranke_zapiski;
create policy stranke_zapiski_vstavljanje on public.stranke_zapiski
  for insert to authenticated
  with check (
    avtor_user_id = auth.uid()
    and public.jp_ima_pravico_clana("ID podjetja", 'stranke.urejanje')
    and exists (select 1 from public."Stranke" s
                where s."ID stranke" = stranke_zapiski."ID stranke"
                  and s."ID Podjetja" = stranke_zapiski."ID podjetja")
  );
-- Brez politik za update/delete: zapiski so samo za dodajanje.

-- ───────────────────────────────────────────────────────────────────────────
-- Funkcije za strežnik (samo service role)
-- ───────────────────────────────────────────────────────────────────────────

-- Rezervira en ukaz: stikalo, uporabnik, omejitev hitrosti, mesečna kvota.
-- Atomarno (zaklep vrstice nastavitev in porabe). Vrne jsonb:
--   {ok:true, ukaz_id, porabljeno, kvota}  ali  {ok:false, koda, porabljeno?, kvota?}
create or replace function public.jp_glas_rezerviraj_ukaz(p_company text, p_user uuid, p_vhod text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_nast   public.glas_nastavitve_podjetja%rowtype;
  v_mesec  date := date_trunc('month', now() at time zone 'Europe/Ljubljana')::date;
  v_porab  integer;
  v_zadnja integer;
  v_ukaz   uuid;
begin
  select * into v_nast from public.glas_nastavitve_podjetja where company_id = p_company for update;
  if not found or not v_nast.vklopljeno then
    return jsonb_build_object('ok', false, 'koda', 'izklopljeno');
  end if;

  if exists (select 1 from public.glas_nastavitve_uporabnika
             where company_id = p_company and user_id = p_user and not vklopljeno) then
    return jsonb_build_object('ok', false, 'koda', 'uporabnik_izklopljen');
  end if;

  select count(*) into v_zadnja from public.glas_ukazi
   where user_id = p_user and created_at > now() - interval '1 minute';
  if v_zadnja >= v_nast.ukazov_na_minuto then
    return jsonb_build_object('ok', false, 'koda', 'prehitro');
  end if;

  insert into public.glas_poraba_mesec (company_id, mesec) values (p_company, v_mesec)
  on conflict (company_id, mesec) do nothing;
  select ukazi into v_porab from public.glas_poraba_mesec
   where company_id = p_company and mesec = v_mesec for update;

  if v_porab >= v_nast.mesecna_kvota then
    return jsonb_build_object('ok', false, 'koda', 'kvota', 'porabljeno', v_porab, 'kvota', v_nast.mesecna_kvota);
  end if;

  update public.glas_poraba_mesec set ukazi = ukazi + 1, updated_at = now()
   where company_id = p_company and mesec = v_mesec;

  insert into public.glas_ukazi (company_id, user_id, vhod) values (p_company, p_user, p_vhod)
  returning id into v_ukaz;

  return jsonb_build_object('ok', true, 'ukaz_id', v_ukaz, 'porabljeno', v_porab + 1,
                            'kvota', v_nast.mesecna_kvota);
end;
$$;

-- Zaključi ukaz: zapiše izid in stroške, prišteje k mesečni porabi.
-- p_vrni_kvoto: ukaz se ne šteje (napaka ponudnika, prazen posnetek). Vrne se največ enkrat.
create or replace function public.jp_glas_zakljuci_ukaz(p_ukaz uuid, p_podatki jsonb, p_vrni_kvoto boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_ukaz  public.glas_ukazi%rowtype;
  v_mesec date;
begin
  select * into v_ukaz from public.glas_ukazi where id = p_ukaz for update;
  if not found or v_ukaz.zakljucen_at is not null then
    return;
  end if;
  v_mesec := date_trunc('month', v_ukaz.created_at at time zone 'Europe/Ljubljana')::date;

  update public.glas_ukazi set
    status               = coalesce(p_podatki->>'status', status),
    prepis               = p_podatki->>'prepis',
    odgovor              = p_podatki->>'odgovor',
    orodja               = coalesce((select array_agg(x) from jsonb_array_elements_text(p_podatki->'orodja') x), '{}'),
    napaka_koda          = p_podatki->>'napaka_koda',
    stt_ponudnik         = p_podatki->>'stt_ponudnik',
    stt_sekunde          = coalesce((p_podatki->>'stt_sekunde')::numeric, 0),
    llm_ponudnik         = p_podatki->>'llm_ponudnik',
    llm_model            = p_podatki->>'llm_model',
    llm_vhod             = coalesce((p_podatki->>'llm_vhod')::int, 0),
    llm_vhod_predpomnjen = coalesce((p_podatki->>'llm_vhod_predpomnjen')::int, 0),
    llm_izhod            = coalesce((p_podatki->>'llm_izhod')::int, 0),
    tts_znaki            = coalesce((p_podatki->>'tts_znaki')::int, 0),
    strosek_mikro_usd    = coalesce((p_podatki->>'strosek_mikro_usd')::numeric, 0),
    trajanje_ms          = coalesce(p_podatki->'trajanje_ms', '{}'::jsonb),
    steje_v_kvoto        = steje_v_kvoto and not p_vrni_kvoto,
    zakljucen_at         = now()
  where id = p_ukaz;

  update public.glas_poraba_mesec set
    ukazi                = ukazi - case when p_vrni_kvoto and v_ukaz.steje_v_kvoto then 1 else 0 end,
    stt_sekunde          = stt_sekunde + coalesce((p_podatki->>'stt_sekunde')::numeric, 0),
    llm_vhod             = llm_vhod + coalesce((p_podatki->>'llm_vhod')::int, 0),
    llm_vhod_predpomnjen = llm_vhod_predpomnjen + coalesce((p_podatki->>'llm_vhod_predpomnjen')::int, 0),
    llm_izhod            = llm_izhod + coalesce((p_podatki->>'llm_izhod')::int, 0),
    tts_znaki            = tts_znaki + coalesce((p_podatki->>'tts_znaki')::int, 0),
    strosek_mikro_usd    = strosek_mikro_usd + coalesce((p_podatki->>'strosek_mikro_usd')::numeric, 0),
    updated_at           = now()
  where company_id = v_ukaz.company_id and mesec = v_mesec;
end;
$$;

-- Začne izvedbo predloga. Atomarno: le en klic preide caka → izvaja.
-- Vrne {ok:true, predlog} ali {ok:false, koda: ni_najden|izvedeno|izvaja|poteklo|zavrnjeno|napaka, rezultat?}
create or replace function public.jp_glas_zacni_potrditev(p_predlog uuid, p_user uuid, p_zeton_hash text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v public.glas_predlogi%rowtype;
begin
  update public.glas_predlogi
     set status = 'izvaja', zacetek_izvedbe = now()
   where id = p_predlog and user_id = p_user and zeton_hash = p_zeton_hash
     and status = 'caka' and potece > now()
  returning * into v;
  if found then
    return jsonb_build_object('ok', true, 'predlog', to_jsonb(v));
  end if;

  select * into v from public.glas_predlogi
   where id = p_predlog and user_id = p_user and zeton_hash = p_zeton_hash;
  if not found then
    return jsonb_build_object('ok', false, 'koda', 'ni_najden');
  end if;
  if v.status = 'caka' then  -- čaka, a je potekel
    update public.glas_predlogi set status = 'poteklo', zakljuceno_at = now()
     where id = v.id and status = 'caka';
    return jsonb_build_object('ok', false, 'koda', 'poteklo');
  end if;
  return jsonb_build_object('ok', false, 'koda', v.status, 'rezultat', v.rezultat, 'napaka', v.napaka);
end;
$$;

create or replace function public.jp_glas_zakljuci_potrditev(p_predlog uuid, p_status text, p_rezultat jsonb, p_napaka text)
returns void
language sql security definer set search_path = public as $$
  update public.glas_predlogi
     set status = p_status, rezultat = p_rezultat, napaka = p_napaka, zakljuceno_at = now()
   where id = p_predlog and status = 'izvaja' and p_status in ('izvedeno', 'napaka');
$$;

create or replace function public.jp_glas_zavrni_predlog(p_predlog uuid, p_user uuid)
returns boolean
language sql security definer set search_path = public as $$
  with u as (
    update public.glas_predlogi set status = 'zavrnjeno', zakljuceno_at = now()
     where id = p_predlog and user_id = p_user and status = 'caka'
    returning 1
  ) select exists (select 1 from u);
$$;

-- Hramba: izbriše prepise in vsebino predlogov po roku podjetja (privzeto 30 dni).
-- Zvok se ne shranjuje nikoli. Kliče ga dnevni cron.
create or replace function public.jp_glas_pocisti()
returns integer
language plpgsql security definer set search_path = public as $$
declare v_n integer := 0; v_m integer;
begin
  update public.glas_ukazi u set prepis = null, odgovor = null
    from (select company_id, hramba_prepisov_dni from public.glas_nastavitve_podjetja) n
   where u.company_id = n.company_id
     and u.created_at < now() - make_interval(days => n.hramba_prepisov_dni)
     and (u.prepis is not null or u.odgovor is not null);
  get diagnostics v_n = row_count;
  update public.glas_ukazi set prepis = null, odgovor = null
   where created_at < now() - interval '30 days'
     and company_id not in (select company_id from public.glas_nastavitve_podjetja)
     and (prepis is not null or odgovor is not null);
  get diagnostics v_m = row_count; v_n := v_n + v_m;
  update public.glas_predlogi set parametri = '{}'::jsonb, povzetek = '(izbrisano po roku hrambe)'
   where created_at < now() - interval '30 days' and parametri <> '{}'::jsonb;
  get diagnostics v_m = row_count; v_n := v_n + v_m;
  return v_n;
end;
$$;

revoke all on function public.jp_glas_rezerviraj_ukaz(text, uuid, text) from public, anon, authenticated;
revoke all on function public.jp_glas_zakljuci_ukaz(uuid, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.jp_glas_zacni_potrditev(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.jp_glas_zakljuci_potrditev(uuid, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.jp_glas_zavrni_predlog(uuid, uuid) from public, anon, authenticated;
revoke all on function public.jp_glas_pocisti() from public, anon, authenticated;
grant execute on function public.jp_glas_rezerviraj_ukaz(text, uuid, text) to service_role;
grant execute on function public.jp_glas_zakljuci_ukaz(uuid, jsonb, boolean) to service_role;
grant execute on function public.jp_glas_zacni_potrditev(uuid, uuid, text) to service_role;
grant execute on function public.jp_glas_zakljuci_potrditev(uuid, text, jsonb, text) to service_role;
grant execute on function public.jp_glas_zavrni_predlog(uuid, uuid) to service_role;
grant execute on function public.jp_glas_pocisti() to service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- Pogled za opazovanje (zadnjih 24 ur, po ponudniku)
-- ───────────────────────────────────────────────────────────────────────────
create or replace view public.glas_zdravje_24h with (security_invoker = true) as
select stt_ponudnik, llm_ponudnik,
       count(*)                                            as ukazov,
       count(*) filter (where status = 'napaka')           as napak,
       percentile_cont(0.5) within group (order by (trajanje_ms->>'skupaj')::numeric) as p50_ms,
       percentile_cont(0.9) within group (order by (trajanje_ms->>'skupaj')::numeric) as p90_ms,
       avg(strosek_mikro_usd)                              as povp_strosek_mikro_usd
  from public.glas_ukazi
 where created_at > now() - interval '24 hours'
 group by 1, 2;

-- ───────────────────────────────────────────────────────────────────────────
-- Vklop za posamezno podjetje (ročno, dokler ni plačil):
--   insert into glas_nastavitve_podjetja (company_id, vklopljeno, mesecna_kvota)
--   values ('<ID podjetja>', true, 400)
--   on conflict (company_id) do update set vklopljeno = excluded.vklopljeno,
--                                          mesecna_kvota = excluded.mesecna_kvota;
--
-- Nazaj:
--   drop view if exists glas_zdravje_24h;
--   drop table if exists stranke_zapiski, glas_revizija, glas_poraba_mesec,
--                        glas_predlogi, glas_ukazi, glas_nastavitve_uporabnika,
--                        glas_nastavitve_podjetja;
--   drop function if exists jp_glas_rezerviraj_ukaz(text, uuid, text),
--     jp_glas_zakljuci_ukaz(uuid, jsonb, boolean), jp_glas_zacni_potrditev(uuid, uuid, text),
--     jp_glas_zakljuci_potrditev(uuid, text, jsonb, text), jp_glas_zavrni_predlog(uuid, uuid),
--     jp_glas_pocisti(), jp_je_skrbnik_podjetja(text), jp_ima_pravico_clana(text, text);
-- ───────────────────────────────────────────────────────────────────────────
