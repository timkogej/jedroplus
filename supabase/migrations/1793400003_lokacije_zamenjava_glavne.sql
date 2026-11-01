-- Več lokacij na podjetje, 4. del: zamenjava glavne lokacije.
--
-- Glavna lokacija je ena na podjetje (unikaten indeks), zato je zamenjava dve
-- posodobitvi, ki morata biti v isti transakciji. Funkcija jo opravi naenkrat
-- in prepiše naslov, telefon, e-pošto, urnik in povezavo za oceno nove glavne
-- lokacije v stara polja ("Podatki podjetij"), da jih stari tokovi berejo
-- pravilno. Kliče jo samo strežnik (service role).
--
-- Zaženi ročno v Supabase SQL editorju. Varno za ponovni zagon.

create or replace function public.jp_nastavi_glavno_lokacijo(p_company text, p_lokacija uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  l public."Lokacije"%rowtype;
begin
  select * into l from public."Lokacije"
   where id = p_lokacija and "ID podjetja" = p_company and status = 'active';
  if not found then
    raise exception 'Lokacija ni na voljo' using errcode = 'P0002';
  end if;
  if l.je_glavna then
    return;
  end if;

  update public."Lokacije" set je_glavna = false, updated_at = now()
   where "ID podjetja" = p_company and je_glavna;
  update public."Lokacije" set je_glavna = true, updated_at = now()
   where id = p_lokacija;
  -- trigger jp_lokacija_v_podatke_t prepiše polja v "Podatki podjetij" le ob
  -- spremembi teh stolpcev, zato jih prepišemo tukaj.
  update public."Podatki podjetij"
     set "Naslov podjetja" = coalesce(l.naslov, "Naslov podjetja"),
         "Kontaktni telefon" = coalesce(l.telefon, "Kontaktni telefon"),
         "Kontaktni_email" = coalesce(l.email, "Kontaktni_email"),
         urnik = coalesce(l.urnik, urnik),
         povezava_ocena = coalesce(l.povezava_ocena, povezava_ocena)
   where "ID Podjetja" = p_company;
end;
$$;

revoke all on function public.jp_nastavi_glavno_lokacijo(text, uuid) from public, anon, authenticated;
grant execute on function public.jp_nastavi_glavno_lokacijo(text, uuid) to service_role;
