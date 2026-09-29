-- Iskanje obstoječe stranke (dvojnika) po enotnem pravilu.
--
-- Zakaj to potrebujemo: doslej se je dvojnik iskal po NATANČNEM nizu telefonske
-- številke, zato sta bila "040 123 456" in "+38640123456" dve stranki.
--
-- Zakaj telefon SAM ne zadošča: v produkciji si eno številko deli do 22 strank.
-- Deloma so to družine, deloma pa saloni vpišejo svojo številko za stranke,
-- ki je nimajo. Ujemanje samo po telefonu bi te ljudi zlepilo v eno osebo,
-- obstoječe vozlišče z "limit 1" pa celo posodobi naključnega med njimi.
--
-- Pravilo:
--   1) e-pošta se ujema                  -> ista oseba (najmočnejši znak)
--   2) telefon IN ime IN priimek se ujemajo -> ista oseba
--   3) sicer                              -> nova stranka
--
-- Zakaj celotno ime in ne le priimek: zakonca si delita telefon IN priimek.
-- "Ana Novak" in "Marko Novak" na isti domači številki bi se ob ujemanju le po
-- priimku zlila v eno osebo.
--
-- Napaki nista enako hudi. Napačno zlitje dveh ljudi tiho pokvari podatke:
-- ena stranka prepiše drugo, termini se pripišejo napačnemu človeku in tega
-- nihče ne opazi. Podvojena vrstica je le nadležna in se jo da pozneje združiti.
-- Zato je pravilo raje strožje.
--
-- Opomba o pravicah: funkcija NI security definer. Tako zanjo velja RLS —
-- prijavljen uporabnik vidi le stranke svojega podjetja, anonimni obiskovalec
-- nobene. n8n dela s servisnim ključem in vidi, kar mora.

-- Primerjalni ključ: male črke, brez šumnikov, brez odvečnih presledkov.
create or replace function public.jp_kljuc(t text)
returns text
language sql
immutable
as $$
  select nullif(
    btrim(regexp_replace(
      lower(translate(
        replace(coalesce(t, ''), 'ß', 'ss'),
        'čćžšđáàâäéèêëíìîïóòôöúùûüñýČĆŽŠĐÁÀÂÄÉÈÊËÍÌÎÏÓÒÔÖÚÙÛÜÑÝ',
        'cczsdaaaaeeeeiiiioooouuuunycczsdaaaaeeeeiiiioooouuuuny'
      )),
      '\s+', ' ', 'g')),
    '');
$$;

create or replace function public.jp_find_client(
  company_id text,
  p_email     text default null,
  p_phone     text default null,
  p_priimek   text default null,
  p_ime       text default null
)
returns table (id bigint, "ID stranke" text, ujemanje text)
language plpgsql
stable
as $$
declare
  e   text := public.jp_kljuc(p_email);
  tel text := public.jp_normalize_phone_for_company(company_id, p_phone);
  pr  text := public.jp_kljuc(p_priimek);
  im  text := public.jp_kljuc(p_ime);
begin
  if company_id is null or btrim(company_id) = '' then
    return;
  end if;

  -- 1) e-pošta
  if e is not null then
    return query
      select s.id, s."ID stranke", 'email'::text
      from public."Stranke" s
      where s."ID Podjetja" = company_id
        and public.jp_kljuc(s."Email stranke") = e
      order by s.id
      limit 1;
    if found then
      return;
    end if;
  end if;

  -- 2) telefon IN celotno ime — vse troje mora biti znano, sicer ne ugibamo
  if tel is not null and pr is not null and im is not null then
    return query
      select s.id, s."ID stranke", 'telefon+ime'::text
      from public."Stranke" s
      where s."ID Podjetja" = company_id
        and s.phone_e164 = tel
        and public.jp_kljuc(s."Priimek") = pr
        and public.jp_kljuc(s."Ime") = im
      order by s.id
      limit 1;
  end if;

  -- 3) sicer ne vrnemo ničesar = nova stranka
end;
$$;

grant execute on function public.jp_kljuc(text) to authenticated, anon, service_role;
grant execute on function public.jp_find_client(text, text, text, text, text)
  to authenticated, anon, service_role;
