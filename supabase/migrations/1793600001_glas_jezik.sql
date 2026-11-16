-- Asistent+: jezik asistenta za podjetje (stran AI, lastnik ali admin ga izbere).
--
-- Privzeto slovenščina. Zapisuje samo strežnik (service role) prek /api/glas/nastavitve,
-- ki preveri vlogo (lastnik/admin) in paket (Pro ali višji) — branje za člane ostane
-- kot doslej (politika glas_np_branje).
-- Idempotentno: ponoven zagon ne pade.

alter table public.glas_nastavitve_podjetja
  add column if not exists jezik text not null default 'sl';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'glas_nastavitve_podjetja_jezik_check'
  ) then
    alter table public.glas_nastavitve_podjetja
      add constraint glas_nastavitve_podjetja_jezik_check check (jezik in ('sl', 'en', 'de', 'it', 'hr'));
  end if;
end $$;

-- Preverjanje po zagonu:
--   select column_name, data_type, column_default from information_schema.columns
--   where table_name = 'glas_nastavitve_podjetja' and column_name = 'jezik';
--
-- Povratek:
--   alter table public.glas_nastavitve_podjetja drop constraint if exists glas_nastavitve_podjetja_jezik_check;
--   alter table public.glas_nastavitve_podjetja drop column if exists jezik;
