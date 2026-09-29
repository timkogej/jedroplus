-- Jezik sporočil: enotna koda in samodejno podedovanje.
--
-- Stanje pred tem: aplikacija zna jezik nastaviti za stranko in za posamezen
-- termin, spletne rezervacije (Booking, Booking v2, Chatbot+) pa ga ne zapišejo
-- nikoli. Stolpec ima privzeto vrednost 'slo', zato je vsaka spletna rezervacija
-- videti kot slovenska, tudi če je stranka Nemka.
--
-- Rešitev je na istem mestu kot pri telefonskih številkah — v bazi, ne v
-- posameznih tokovih. Tako velja za vse poti hkrati, tudi za tiste, ki jih
-- bomo šele naredili.
--
-- Zapis je tudi neenoten: med termini jih ima 810 'sl' in 190 'slo'. Isti jezik,
-- dva zapisa. Od zdaj se ob vsakem pisanju poenoti.

-- 1) Kode, kot jih uporablja aplikacija (lib/communicationLanguage.ts):
--    slo | eng | de | it | hr
create or replace function public.jp_normalize_language(raw text)
returns text
language sql
immutable
as $$
  select case lower(btrim(coalesce(raw, '')))
    when 'sl'          then 'slo'
    when 'si'          then 'slo'
    when 'slo'         then 'slo'
    when 'slovenian'   then 'slo'
    when 'slovenscina' then 'slo'
    when 'en'          then 'eng'
    when 'eng'         then 'eng'
    when 'english'     then 'eng'
    when 'de'          then 'de'
    when 'ger'         then 'de'
    when 'deu'         then 'de'
    when 'german'      then 'de'
    when 'deutsch'     then 'de'
    when 'it'          then 'it'
    when 'ita'         then 'it'
    when 'italian'     then 'it'
    when 'italiano'    then 'it'
    when 'hr'          then 'hr'
    when 'hrv'         then 'hr'
    when 'cro'         then 'hr'
    when 'croatian'    then 'hr'
    when 'hrvatski'    then 'hr'
    else null
  end;
$$;

-- 2) Jezik podjetja: najprej "jezik posiljanja" (to bere pošiljanje),
--    nato language, nato preferred_language.
create or replace function public.jp_company_language(company_id text)
returns text
language sql
stable
-- security definer: RLS skrije "Podatki podjetij" pred anonimnim obiskovalcem
-- registracijske in rezervacijske strani. Brez tega bi funkcija tam vrnila
-- prazno in bi vsi tiho dobili slovenščino. Vrne le kodo jezika za ID podjetja,
-- ki ga klicatelj ze ima v rokah.
security definer
set search_path = public
as $$
  select coalesce(
    public.jp_normalize_language(pp."jezik posiljanja"),
    public.jp_normalize_language(pp."language"),
    public.jp_normalize_language(pp."preferred_language"),
    'slo'
  )
  from public."Podatki podjetij" pp
  where pp."ID Podjetja" = company_id
  limit 1;
$$;

-- 3) Privzeta vrednost stolpca mora stran, sicer sprožilec ne more ločiti
--    "nihče ni povedal" od "nekdo je izrecno izbral slovenščino".
--    NOT NULL ostane — sprožilec teče pred preverjanjem omejitev in vedno
--    vrne vrednost.
alter table public."Stranke" alter column language drop default;
alter table public."Termini" alter column language drop default;

-- 4) Stranka: izbrani jezik, sicer jezik podjetja.
create or replace function public.jp_stranke_language()
returns trigger
language plpgsql
as $$
begin
  new.language := coalesce(
    public.jp_normalize_language(new.language),
    public.jp_company_language(new."ID Podjetja"),
    'slo'
  );
  return new;
end;
$$;

drop trigger if exists trg_stranke_language on public."Stranke";
create trigger trg_stranke_language
  before insert or update of language, "ID Podjetja"
  on public."Stranke"
  for each row
  execute function public.jp_stranke_language();

-- 5) Termin: izbrani jezik, sicer jezik stranke, sicer jezik podjetja.
--    Ta vrstni red je namenoma tak: za posamezen termin ga je mogoče prevoziti
--    (npr. stranka to pot pride s prijateljico, ki govori nemško).
--
--    POZOR pri imenih stolpcev: "Termini" ima "ID podjetja" z malo p,
--    "Stranke" pa "ID Podjetja" z veliko. To ni tipkarska napaka.
create or replace function public.jp_termini_language()
returns trigger
language plpgsql
as $$
declare
  jezik_stranke text;
begin
  if public.jp_normalize_language(new.language) is not null then
    new.language := public.jp_normalize_language(new.language);
    return new;
  end if;

  select public.jp_normalize_language(s.language) into jezik_stranke
  from public."Stranke" s
  where s."ID stranke" = new."ID stranke"
    and s."ID Podjetja" = new."ID podjetja"
  limit 1;

  new.language := coalesce(
    jezik_stranke,
    public.jp_company_language(new."ID podjetja"),
    'slo'
  );
  return new;
end;
$$;

drop trigger if exists trg_termini_language on public."Termini";
create trigger trg_termini_language
  before insert or update of language, "ID stranke", "ID podjetja"
  on public."Termini"
  for each row
  execute function public.jp_termini_language();

grant execute on function public.jp_normalize_language(text) to authenticated, anon, service_role;
grant execute on function public.jp_company_language(text) to authenticated, anon, service_role;
