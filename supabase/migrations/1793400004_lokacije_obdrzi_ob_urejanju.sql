-- Več lokacij na podjetje, 5. del: urejanje termina ne sme izgubiti lokacije.
--
-- Sprožilec iz 1793400001 je ob vsakem vnosu ali spremembi stolpca lokacija_id
-- brez vrednosti vpisal glavno lokacijo. Ko bo n8n pri urejanju termina pošiljal
-- tudi lokacija_id (prazen, kadar ga aplikacija ne pozna), bi to termin z druge
-- lokacije vrnilo na glavno. Zdaj velja:
--   vnos      brez lokacije -> glavna lokacija
--   urejanje  brez lokacije -> ostane dosedanja (in šele nato glavna)
--
-- Zaženi ročno v Supabase SQL editorju. Varno za ponovni zagon.

create or replace function public.jp_privzeta_lokacija()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.lokacija_id is null then
    if tg_op = 'UPDATE' then
      new.lokacija_id := old.lokacija_id;
    end if;
    if new.lokacija_id is null then
      new.lokacija_id := public.jp_glavna_lokacija(new."ID podjetja");
    end if;
  end if;
  return new;
end;
$$;
