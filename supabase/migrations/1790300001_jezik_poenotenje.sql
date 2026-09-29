-- Poenotenje že zapisanih jezikovnih kod.
--
-- Loceno od 1790300000 namenoma, enako kot pri telefonskih stevilkah:
-- prvo migracijo pozenes in preveris, sele nato se dotaknes starih vrstic.
--
-- Kaj se spremeni: samo zapis kode, ne pomen. 'sl' in 'slo' sta isti jezik;
-- po tem so vse vrstice zapisane kot 'slo'. Vrstice, ki so ze zapisane
-- pravilno, se ne dotaknejo (pogoj is distinct from).
--
-- Nazaj: povrni iz varnostne kopije baze — stara zapisa 'sl' in 'slo' po tem
-- nista vec locljiva, ker sta pomenila isto.

update public."Termini"
  set language = public.jp_normalize_language(language)
  where public.jp_normalize_language(language) is not null
    and public.jp_normalize_language(language) is distinct from language;

update public."Stranke"
  set language = public.jp_normalize_language(language)
  where public.jp_normalize_language(language) is not null
    and public.jp_normalize_language(language) is distinct from language;

-- Vrstice, ki jih normalizator ne prepozna (npr. tipkarska napaka), ostanejo
-- nedotaknjene in jih je treba pogledati rocno:
--   select distinct language from public."Termini"
--   where jp_normalize_language(language) is null;
