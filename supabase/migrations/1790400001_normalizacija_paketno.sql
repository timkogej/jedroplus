-- Paketna normalizacija telefonskih številk.
--
-- Uvoz CRM primerja več sto vrstic naenkrat. Klic jp_find_client za vsako
-- vrstico posebej bi pomenil več sto obhodov do baze, zato tu potrebujemo
-- eno samo pot: pošljemo vse številke iz datoteke, dobimo nazaj enako dolg
-- seznam v enotni obliki.
--
-- Namen je tudi, da pravila NE prepisujemo v TypeScript. Obstaja naj na enem
-- mestu; aplikacija ga samo vpraša.
--
-- Vrstni red je ohranjen: izhod[i] pripada vhodu[i]. Številka, ki je ni
-- mogoče razumeti, se vrne kot NULL.

create or replace function public.jp_normalize_phones(
  company_id text, phones text[]
) returns text[]
language sql
stable
as $$
  select case
    when phones is null then null
    else array(
      select public.jp_normalize_phone_for_company(company_id, p)
      from unnest(phones) with ordinality as t(p, i)
      order by i
    )
  end;
$$;

grant execute on function public.jp_normalize_phones(text, text[])
  to authenticated, anon, service_role;
