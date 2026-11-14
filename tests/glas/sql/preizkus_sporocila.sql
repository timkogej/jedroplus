-- Preizkus migracije 1793700000_glas_sporocila.sql (zažene tests/glas/sql/zazeni.sh po preizkus.sql)
\set ON_ERROR_STOP on
grant all on all tables in schema public to authenticated, service_role;

create or replace function pg_temp.mora(p boolean, opis text) returns void language plpgsql as $$
begin if not coalesce(p, false) then raise exception 'NEUSPEH: %', opis; end if;
      raise notice 'ok: %', opis; end $$;

-- 1. Omejitev na stranko (3) in na podjetje (5 v preizkusu)
select pg_temp.mora((jp_glas_rezerviraj_sporocilo('AAAAAA', '11111111-1111-1111-1111-111111111111', null, '1000001', 'T1', 'sms', 60, 3, 5)->>'ok')::boolean, 'prvo sporočilo');
select pg_temp.mora((jp_glas_rezerviraj_sporocilo('AAAAAA', '11111111-1111-1111-1111-111111111111', null, '1000001', 'T1', 'sms', 60, 3, 5)->>'ok')::boolean, 'drugo sporočilo');
select pg_temp.mora((jp_glas_rezerviraj_sporocilo('AAAAAA', '11111111-1111-1111-1111-111111111111', null, '1000001', 'T1', 'email', 60, 3, 5)->>'ok')::boolean, 'tretje sporočilo');
select pg_temp.mora((jp_glas_rezerviraj_sporocilo('AAAAAA', '11111111-1111-1111-1111-111111111111', null, '1000001', 'T1', 'sms', 60, 3, 5)->>'koda') = 'stranka', 'četrto isti stranki zavrnjeno');

-- neuspešno se ne šteje
select jp_glas_zakljuci_sporocilo((select id from glas_sporocila order by created_at limit 1), 'kvota', 'quota_exceeded');
select pg_temp.mora((jp_glas_rezerviraj_sporocilo('AAAAAA', '11111111-1111-1111-1111-111111111111', null, '1000001', 'T1', 'sms', 60, 3, 5)->>'ok')::boolean, 'po neuspehu (kvota) spet dovoljeno');
-- zaključek je enkraten
select jp_glas_zakljuci_sporocilo((select id from glas_sporocila where status = 'kvota'), 'poslano', null);
select pg_temp.mora((select count(*) = 1 from glas_sporocila where status = 'kvota'), 'zaključeno ne spremeni statusa');

select pg_temp.mora((jp_glas_rezerviraj_sporocilo('AAAAAA', '11111111-1111-1111-1111-111111111111', null, '1000002', 'T2', 'sms', 60, 3, 5)->>'ok')::boolean, 'druga stranka');
select pg_temp.mora((jp_glas_rezerviraj_sporocilo('AAAAAA', '11111111-1111-1111-1111-111111111111', null, '1000003', 'T3', 'sms', 60, 3, 5)->>'ok')::boolean, 'tretja stranka (5. za podjetje)');
select pg_temp.mora((jp_glas_rezerviraj_sporocilo('AAAAAA', '11111111-1111-1111-1111-111111111111', null, '1000004', 'T4', 'sms', 60, 3, 5)->>'koda') = 'podjetje', 'šesto za podjetje zavrnjeno');
select pg_temp.mora((jp_glas_rezerviraj_sporocilo('BBBBBB', '33333333-3333-3333-3333-333333333333', null, '2000001', 'T9', 'sms', 60, 3, 5)->>'ok')::boolean, 'drugo podjetje ima svojo omejitev');

-- včerajšnja se ne štejejo
update glas_sporocila set created_at = now() - interval '2 days' where company_id = 'AAAAAA';
select pg_temp.mora((jp_glas_rezerviraj_sporocilo('AAAAAA', '11111111-1111-1111-1111-111111111111', null, '1000001', 'T1', 'sms', 60, 3, 5)->>'ok')::boolean, 'nov dan, nova omejitev');

-- 2. Pravice: authenticated ne kliče funkcij in ne piše; bere samo svoje podjetje
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
do $$ begin
  perform jp_glas_rezerviraj_sporocilo('AAAAAA', '11111111-1111-1111-1111-111111111111', null, '1000001', 'T1', 'sms', 60, 99, 99);
  raise exception 'NEUSPEH: uporabnik je sam rezerviral';
exception when insufficient_privilege then raise notice 'ok: rezervacija samo service role';
end $$;
do $$ begin
  insert into glas_sporocila (company_id, user_id, id_stranke, id_termina, kanal, dolzina)
    values ('AAAAAA', '11111111-1111-1111-1111-111111111111', '1', 'T', 'sms', 1);
  raise exception 'NEUSPEH: uporabnik je sam vstavil';
exception when insufficient_privilege then raise notice 'ok: vstavljanje samo service role';
end $$;
select pg_temp.mora((select count(*) > 0 from glas_sporocila) and (select bool_and(company_id = 'AAAAAA') from glas_sporocila), 'lastnik A vidi samo A');
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
select pg_temp.mora((select bool_and(company_id = 'BBBBBB') from glas_sporocila), 'lastnik B ne vidi A');
reset role;
\echo SPOROČILA: VSI SQL PREIZKUSI USPEŠNI

-- 1793700001: ponudba prostega termina brez termina (id_termina null), ista omejitev
select pg_temp.mora((jp_glas_rezerviraj_sporocilo('CCCCCC', '11111111-1111-1111-1111-111111111111', null, '3000001', null, 'sms', 60, 3, 5)->>'ok')::boolean, 'ponudba brez termina');
select pg_temp.mora((select id_termina is null from glas_sporocila where company_id = 'CCCCCC'), 'id_termina je null');
