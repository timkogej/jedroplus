-- Preizkus migracije 1793700003_termini_serije.sql (zažene tests/glas/sql/zazeni.sh).
\set ON_ERROR_STOP on
create or replace function pg_temp.mora(p boolean, opis text) returns void language plpgsql as $$
begin if not coalesce(p, false) then raise exception 'NEUSPEH: %', opis; end if;
      raise notice 'ok: %', opis; end $$;

insert into companies values ('bbbbbbbb-0000-0000-0000-00000000000b', 'SER01'), ('cccccccc-0000-0000-0000-00000000000c', 'SER02') on conflict do nothing;
insert into company_members values ('bbbbbbbb-0000-0000-0000-00000000000b', '33333333-3333-3333-3333-333333333333', 'staff', null);
insert into "Termini" values
  ('S-1', 'SER01', current_date + 7, '10:00', 'scheduled', null),
  ('S-2', 'SER01', current_date + 14, '10:00', 'scheduled', null),
  ('S-3', 'SER01', current_date + 21, '10:00', 'scheduled', null),
  ('X-1', 'SER02', current_date + 7, '10:00', 'scheduled', null);

select pg_temp.mora(jp_termini_serija_dodaj('SER01', array['S-1'], 1, null)->>'koda' = 'stevilo', 'en termin ni serija');
select pg_temp.mora(jp_termini_serija_dodaj('SER01', array['S-1', 'X-1'], 1, null)->>'koda' = 'tuji_termini', 'tuj termin zavrne serijo');
select pg_temp.mora(jp_termini_serija_dodaj('SER01', array['S-1', 'S-1'], 1, null)->>'koda' = 'podvojeni', 'podvojen termin');
select pg_temp.mora((jp_termini_serija_dodaj('SER01', array['S-1', 'S-2', 'S-3'], 1, '33333333-3333-3333-3333-333333333333')->>'ok')::boolean, 'serija treh');
select pg_temp.mora((select array_agg(id_termina order by zap) from termini_serije_clani) = array['S-1', 'S-2', 'S-3'], 'vrstni red');
select pg_temp.mora(jp_termini_serija_dodaj('SER01', array['S-2', 'S-3'], 1, null)->>'koda' = 'ze_v_seriji', 'termin je že v seriji');

-- RLS: član vidi svojo serijo; brez pravice ali tuj ne; pisati ne more.
set role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
select pg_temp.mora((select count(*) from termini_serije_clani) = 3, 'član bere člane serije');
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
select pg_temp.mora((select count(*) from termini_serije_clani) = 0, 'nečlan ne vidi');
do $$ begin
  insert into termini_serije (company_id, vsakih_tednov) values ('SER01', 1);
  raise exception 'NEUSPEH: authenticated ne sme pisati';
exception when insufficient_privilege then raise notice 'ok: authenticated ne piše';
end $$;
do $$ begin
  perform jp_termini_serija_dodaj('SER01', array['S-1', 'S-2'], 1, null);
  raise exception 'NEUSPEH: authenticated ne sme klicati';
exception when insufficient_privilege then raise notice 'ok: authenticated ne kliče';
end $$;
reset role;
