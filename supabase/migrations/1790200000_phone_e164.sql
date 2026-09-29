-- Enotna oblika telefonskih številk (E.164) za tabelo "Stranke".
--
-- Zakaj v bazi in ne v aplikaciji: stranko vpisuje osem različnih mest —
-- aplikacija, registracijska stran client.jedroplus.com, rezervacije, chatbot,
-- uvoz CRM in trije n8n tokovi. Sprožilec pokrije vse naenkrat, tudi tiste,
-- ki jih bomo dodali pozneje.
--
-- Natipkana številka se NE spreminja: "Telefonska številka" ostane taka, kot jo
-- je človek vnesel, ker jo tako tudi prepozna. Zraven nastane phone_e164, po
-- kateri iščemo dvojnike in pošiljamo SMS.

-- 1) Klicne kode že imamo v sms_countries. Manjka le podatek, ali država pozna
--    vodilno ničlo pri domačem zapisu. Italija je ne — italijanske mobilne
--    številke se začnejo s 3 in se ta 3 NE odreže.
alter table public.sms_countries
  add column if not exists trunk_prefix text;

update public.sms_countries set trunk_prefix = '0'
  where country_code in ('SI', 'HR', 'AT', 'DE') and trunk_prefix is null;
update public.sms_countries set trunk_prefix = null
  where country_code = 'IT';

-- 2) Čista pretvorba. Brez dostopa do tabel, da je immutable in hitra.
--    dial  = klicna koda z + (npr. '+386')
--    trunk = vodilna števka domačega zapisa ali NULL (npr. '0')
create or replace function public.jp_normalize_phone(
  raw text, dial text, trunk text default '0'
) returns text
language plpgsql
immutable
as $$
declare
  s      text;
  d      text;
  ostalo text;
begin
  if raw is null then return null; end if;

  -- Obdržimo samo števke in plus.
  s := regexp_replace(raw, '[^0-9+]', '', 'g');
  if s = '' then return null; end if;

  -- Plus sme stati le na začetku. "040+123" ni ne domača ne mednarodna
  -- številka, ampak napaka pri tipkanju — takega ugibati nočemo.
  if strpos(substr(s, 2), '+') > 0 then return null; end if;
  if s = '+' then return null; end if;

  -- 00386... je isto kot +386...
  if left(s, 2) = '00' then
    s := '+' || substr(s, 3);
  end if;

  d := ltrim(coalesce(dial, ''), '+');
  if d = '' then
    -- Klicne kode ne poznamo. Mednarodni zapis še vedno sprejmemo,
    -- domačega pa ne moremo uganiti.
    if left(s, 1) <> '+' then return null; end if;
  end if;

  if left(s, 1) <> '+' then
    if trunk is not null and trunk <> '' and left(s, length(trunk)) = trunk then
      -- Domači zapis: 040... -> +386 40...
      s := '+' || d || substr(s, length(trunk) + 1);
    elsif trunk is not null and left(s, length(d)) = d
          and length(s) - length(d) between 6 and 12 then
      -- Mednarodna številka brez plusa: 38640123456 -> +38640123456.
      -- Samo za države z vodilno ničlo; v Italiji bi to odrezalo pravo števko.
      s := '+' || s;
    else
      s := '+' || d || s;
    end if;
  end if;

  -- E.164 dovoli 1-15 števk; karkoli krajšega od 8 je pri nas smetje.
  ostalo := substr(s, 2);
  if length(ostalo) < 8 or length(ostalo) > 15 then
    return null;
  end if;

  return s;
end;
$$;

-- 3) Ovojnica, ki klicno kodo poišče iz države podjetja.
--    Uporabljata jo tudi aplikacija in n8n, da je pravilo na enem mestu.
create or replace function public.jp_normalize_phone_for_company(
  company_id text, raw text
) returns text
language plpgsql
stable
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

  -- Država, ki je (še) ni v sms_countries: privzamemo Slovenijo, ker so tam
  -- vsa dosedanja podjetja. Ko dodamo državo v sms_countries, to odpade samo.
  if d is null then
    d := '+386';
    t := '0';
  end if;

  return public.jp_normalize_phone(raw, d, t);
end;
$$;

-- 4) Stolpec + sprožilec.
alter table public."Stranke"
  add column if not exists phone_e164 text;

create or replace function public.jp_stranke_phone_e164()
returns trigger
language plpgsql
as $$
begin
  new.phone_e164 := public.jp_normalize_phone_for_company(
    new."ID Podjetja", new."Telefonska številka"
  );
  return new;
end;
$$;

drop trigger if exists trg_stranke_phone_e164 on public."Stranke";
create trigger trg_stranke_phone_e164
  before insert or update of "Telefonska številka", "ID Podjetja"
  on public."Stranke"
  for each row
  execute function public.jp_stranke_phone_e164();

-- 5) Iskanje dvojnikov po podjetju.
create index if not exists idx_stranke_company_phone_e164
  on public."Stranke" ("ID Podjetja", phone_e164)
  where phone_e164 is not null;

grant execute on function public.jp_normalize_phone(text, text, text) to authenticated, anon, service_role;
grant execute on function public.jp_normalize_phone_for_company(text, text) to authenticated, anon, service_role;
