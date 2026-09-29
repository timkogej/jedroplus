-- Popravek: jp_normalize_phone_for_company je brala "Podatki podjetij" in
-- sms_countries s pravicami klicatelja. RLS obe tabeli skrije pred anonimnim
-- obiskovalcem (registracijska in rezervacijska stran), zato bi funkcija tam
-- vrnila prazno in tiho padla na slovensko klicno kodo.
--
-- Danes se to ne pozna, ker so vsa podjetja v Sloveniji in je privzeta vrednost
-- po naklucju pravilna. Pri prvem hrvaskem ali avstrijskem podjetju bi bila
-- napacna, napake pa ne bi nihce opazil.
--
-- Funkcija sprejme ID podjetja, ki ga klicatelj ze ima, in vrne eno samo
-- telefonsko stevilko v enotni obliki. Nic novega ne razkrije.

create or replace function public.jp_normalize_phone_for_company(
  company_id text, raw text
) returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  drzava text;
  d      text;
  t      text;
begin
  select pp."country_code" into drzava
  from public."Podatki podjetij" pp
  where pp."ID Podjetja" = company_id
  limit 1;

  select c.dial_code, c.trunk_prefix into d, t
  from public.sms_countries c
  where c.country_code = upper(coalesce(drzava, 'SI'))
  limit 1;

  if d is null then
    d := '+386';
    t := '0';
  end if;

  return public.jp_normalize_phone(raw, d, t);
end;
$$;
