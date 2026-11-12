-- Preizkus migracije 1793500000_glasovni_asistent.sql (zažene tests/glas/sql/zazeni.sh)
\set ON_ERROR_STOP on
-- Kot v Supabase: vloge imajo privzeto vse pravice na tabelah, varuje jih RLS.
grant all on all tables in schema public to authenticated, service_role;

-- Podjetji A in B; lastnik A, zaposleni A (brez pravice urejanja), lastnik B
insert into companies values ('00000000-0000-0000-0000-00000000000a', 'AAAAAA'),
                             ('00000000-0000-0000-0000-00000000000b', 'BBBBBB');
insert into company_members values
  ('00000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'owner', null),
  ('00000000-0000-0000-0000-00000000000a', '22222222-2222-2222-2222-222222222222', 'staff', 5),
  ('00000000-0000-0000-0000-00000000000b', '33333333-3333-3333-3333-333333333333', 'owner', null);
insert into staff_role_permissions (company_id, can_edit_clients, can_access_asistent_plus)
  values ('00000000-0000-0000-0000-00000000000a', false, true);
insert into "Stranke" values ('1000001', 'AAAAAA', 'Ana'), ('2000001', 'BBBBBB', 'Bojan');

create or replace function pg_temp.mora(p boolean, opis text) returns void language plpgsql as $$
begin if not coalesce(p, false) then raise exception 'NEUSPEH: %', opis; end if;
      raise notice 'ok: %', opis; end $$;

-- 1. Pravice
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select pg_temp.mora(jp_ima_pravico_clana('AAAAAA', 'stranke.urejanje'), 'lastnik sme urejati');
select pg_temp.mora(not jp_ima_pravico_clana('BBBBBB', 'stranke.branje'), 'lastnik A ne vidi B');
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
select pg_temp.mora(not jp_ima_pravico_clana('AAAAAA', 'stranke.urejanje'), 'zaposleni brez can_edit_clients ne sme urejati');
select pg_temp.mora(jp_ima_pravico_clana('AAAAAA', 'stranke.branje'), 'zaposleni sme brati');
select pg_temp.mora(jp_ima_pravico_clana('AAAAAA', 'glas.uporaba'), 'zaposleni s can_access_asistent_plus sme glas');
select pg_temp.mora(not jp_ima_pravico_clana('AAAAAA', 'neznana.pravica'), 'neznana pravica = ne');

-- 2. RLS na zapiskih
do $$ begin
  insert into stranke_zapiski ("ID podjetja", "ID stranke", kategorija, besedilo)
    values ('AAAAAA', '1000001', 'opomba', 'x');
  raise exception 'NEUSPEH: zaposleni brez pravice je vstavil zapisek';
exception when insufficient_privilege then raise notice 'ok: zaposleni brez pravice ne vstavi';
end $$;

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
insert into stranke_zapiski ("ID podjetja", "ID stranke", kategorija, besedilo, vir)
  values ('AAAAAA', '1000001', 'barva', '6.3 z 7.1, 30 g, 6 %, 35 min', 'glas');
select pg_temp.mora((select count(*) = 1 from stranke_zapiski), 'lastnik vstavi zapisek');
do $$ begin
  insert into stranke_zapiski ("ID podjetja", "ID stranke", kategorija, besedilo)
    values ('BBBBBB', '2000001', 'opomba', 'vdor');
  raise exception 'NEUSPEH: zapisek v tuje podjetje';
exception when insufficient_privilege then raise notice 'ok: tuje podjetje zavrnjeno';
end $$;
do $$ begin
  insert into stranke_zapiski ("ID podjetja", "ID stranke", kategorija, besedilo)
    values ('AAAAAA', '2000001', 'opomba', 'tuja stranka');
  raise exception 'NEUSPEH: tuja stranka v svojem podjetju';
exception when insufficient_privilege then raise notice 'ok: stranka drugega podjetja zavrnjena';
end $$;
do $$ begin
  insert into stranke_zapiski ("ID podjetja", "ID stranke", kategorija, besedilo, avtor_user_id)
    values ('AAAAAA', '1000001', 'opomba', 'ponarejen avtor', '33333333-3333-3333-3333-333333333333');
  raise exception 'NEUSPEH: ponarejen avtor';
exception when insufficient_privilege then raise notice 'ok: ponarejen avtor zavrnjen';
end $$;
update stranke_zapiski set besedilo = 'spremenjeno';
select pg_temp.mora((select besedilo <> 'spremenjeno' from stranke_zapiski limit 1), 'zapiska ni mogoče spreminjati');
delete from stranke_zapiski;
select pg_temp.mora((select count(*) = 1 from stranke_zapiski), 'zapiska ni mogoče izbrisati');
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
select pg_temp.mora((select count(*) = 0 from stranke_zapiski), 'lastnik B ne vidi zapiskov A');

-- 3. Funkcije za strežnik niso dostopne članom
do $$ begin
  perform jp_glas_rezerviraj_ukaz('BBBBBB', '33333333-3333-3333-3333-333333333333', 'aplikacija');
  raise exception 'NEUSPEH: član je klical strežniško funkcijo';
exception when insufficient_privilege then raise notice 'ok: rezervacija samo za service role';
end $$;
reset role;

-- 4. Kvota, stikalo, omejitev hitrosti (kot service role)
set role service_role;
select pg_temp.mora((jp_glas_rezerviraj_ukaz('AAAAAA', '11111111-1111-1111-1111-111111111111', 'aplikacija')->>'koda') = 'izklopljeno', 'brez nastavitev = izklopljeno');
insert into glas_nastavitve_podjetja (company_id, vklopljeno, mesecna_kvota, ukazov_na_minuto) values ('AAAAAA', true, 3, 2);
select pg_temp.mora((jp_glas_rezerviraj_ukaz('AAAAAA', '11111111-1111-1111-1111-111111111111', 'aplikacija')->>'ok')::boolean, 'prvi ukaz');
select pg_temp.mora((jp_glas_rezerviraj_ukaz('AAAAAA', '11111111-1111-1111-1111-111111111111', 'aplikacija')->>'ok')::boolean, 'drugi ukaz');
select pg_temp.mora((jp_glas_rezerviraj_ukaz('AAAAAA', '11111111-1111-1111-1111-111111111111', 'aplikacija')->>'koda') = 'prehitro', 'tretji v minuti = prehitro');
select pg_temp.mora((jp_glas_rezerviraj_ukaz('AAAAAA', '22222222-2222-2222-2222-222222222222', 'aplikacija')->>'ok')::boolean, 'drug uporabnik, tretji ukaz');
select pg_temp.mora((jp_glas_rezerviraj_ukaz('AAAAAA', '22222222-2222-2222-2222-222222222222', 'aplikacija')->>'koda') = 'kvota', 'kvota 3 porabljena');

-- vrnitev kvote enkrat
select jp_glas_zakljuci_ukaz((select id from glas_ukazi order by created_at limit 1),
  '{"status":"napaka","napaka_koda":"stt","strosek_mikro_usd":12.5,"stt_sekunde":4}'::jsonb, true);
select jp_glas_zakljuci_ukaz((select id from glas_ukazi order by created_at limit 1),
  '{"status":"napaka"}'::jsonb, true);
select pg_temp.mora((select ukazi = 2 and strosek_mikro_usd = 12.5 and stt_sekunde = 4 from glas_poraba_mesec), 'kvota vrnjena enkrat, strošek zapisan');

insert into glas_nastavitve_uporabnika (company_id, user_id, vklopljeno) values ('AAAAAA', '22222222-2222-2222-2222-222222222222', false);
select pg_temp.mora((jp_glas_rezerviraj_ukaz('AAAAAA', '22222222-2222-2222-2222-222222222222', 'aplikacija')->>'koda') = 'uporabnik_izklopljen', 'izklopljen uporabnik');

-- 5. Potrditev: idempotenca, tuj uporabnik, potek
insert into glas_predlogi (id, company_id, user_id, orodje, razred, parametri, parametri_hash, zeton_hash, povzetek, potece)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'AAAAAA', '11111111-1111-1111-1111-111111111111', 'dodaj_zapisek', 'pisanje', '{}', 'h', 'z1', 'p', now() + interval '2 minutes'),
       ('aaaaaaaa-0000-0000-0000-000000000002', 'AAAAAA', '11111111-1111-1111-1111-111111111111', 'dodaj_zapisek', 'pisanje', '{}', 'h', 'z2', 'p', now() - interval '1 second');
select pg_temp.mora((jp_glas_zacni_potrditev('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'z1')->>'koda') = 'ni_najden', 'tuj uporabnik ne potrdi');
select pg_temp.mora((jp_glas_zacni_potrditev('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'napacen')->>'koda') = 'ni_najden', 'napačen žeton');
select pg_temp.mora((jp_glas_zacni_potrditev('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'z1')->>'ok')::boolean, 'prva potrditev');
select pg_temp.mora((jp_glas_zacni_potrditev('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'z1')->>'koda') = 'izvaja', 'druga med izvajanjem = izvaja');
select jp_glas_zakljuci_potrditev('aaaaaaaa-0000-0000-0000-000000000001', 'izvedeno', '{"zapisek_id":"x"}', null);
select pg_temp.mora((jp_glas_zacni_potrditev('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'z1')->'rezultat'->>'zapisek_id') = 'x', 'ponovitev vrne shranjen rezultat');
select pg_temp.mora((jp_glas_zacni_potrditev('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'z2')->>'koda') = 'poteklo', 'potekel predlog');
select pg_temp.mora((select status = 'poteklo' from glas_predlogi where id = 'aaaaaaaa-0000-0000-0000-000000000002'), 'status poteklo zapisan');
select pg_temp.mora(not jp_glas_zavrni_predlog('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111'), 'izvedenega ni mogoče zavrniti');

-- 6. Hramba
update glas_ukazi set prepis = 'Ana Novak barva', created_at = now() - interval '40 days';
select pg_temp.mora(jp_glas_pocisti() >= 1, 'čiščenje teče');
select pg_temp.mora((select bool_and(prepis is null) from glas_ukazi), 'stari prepisi izbrisani');
reset role;

-- 7. Člani berejo samo svoje ukaze, B ne vidi A
set role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
select pg_temp.mora((select count(*) = 0 from glas_ukazi), 'B ne vidi ukazov A');
select pg_temp.mora((select count(*) = 0 from glas_poraba_mesec), 'B ne vidi porabe A');
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
select pg_temp.mora((select bool_and(user_id = '22222222-2222-2222-2222-222222222222') from glas_ukazi), 'zaposleni vidi samo svoje ukaze');
select pg_temp.mora((select count(*) = 0 from glas_revizija), 'zaposleni ne vidi revizije');
reset role;
\echo VSI SQL PREIZKUSI USPEŠNI
