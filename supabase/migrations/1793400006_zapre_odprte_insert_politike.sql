-- Zapre odprte INSERT politike (with check = true), ki jih je našel pregled pg_policies.
--
-- Politika "with check (true)" pomeni, da lahko kdorkoli z javnim ključem
-- aplikacije (viden v brskalniku) vpiše vrstico v katerokoli podjetje.
--
-- Kdo dejansko piše v te tabele (preverjeno v kodi in n8n kopijah):
--   Resursi, Storitve_Resursi, zgodovina   aplikacija, prek prijavljenega uporabnika
--                                          -> pisanje samo za člane tistega podjetja
--   Termini_Resursi, customer_portal_tokens  samo n8n (service role, RLS ga obide)
--                                          -> politika se odstrani; brez nje je pisanje
--                                             zaprto za vse razen service role
--
-- NE spreminjam (namerno, ker jih lahko uporablja javni obrazec ali javna stran):
--   consent_records  "Anyone can insert consent" — ime pove, da je javno vpisovanje privolitev
--   Public read add_on_storitve / happy_hours / happy_hours_storitve / popusti / popusti_storitve
--   plans_select_authenticated
--
-- Politike z imeni iz pregleda; če katere ni, se preskoči. Varno za ponovni zagon.
-- Zahteva 1793300000 (funkcija jp_je_clan_podjetja).
--
-- Nazaj (po tabelah, enako kot prej):
--   create policy "Resursi INSERT" on public."Resursi" for insert with check (true);
--   create policy "Storitve_Resursi INSERT" on public."Storitve_Resursi" for insert with check (true);
--   create policy "Termini_Resursi INSERT" on public."Termini_Resursi" for insert with check (true);
--   create policy "customer_portal_tokens INSERT" on public.customer_portal_tokens for insert with check (true);
--   create policy "Dovoli insert v zgodovino" on public.zgodovina for insert with check (true);

-- Pisanje samo za člane podjetja
drop policy if exists "Resursi INSERT" on public."Resursi";
create policy "Resursi INSERT" on public."Resursi"
  for insert to authenticated
  with check (public.jp_je_clan_podjetja("ID podjetja"));

drop policy if exists "Storitve_Resursi INSERT" on public."Storitve_Resursi";
create policy "Storitve_Resursi INSERT" on public."Storitve_Resursi"
  for insert to authenticated
  with check (public.jp_je_clan_podjetja("ID podjetja"));

drop policy if exists "Dovoli insert v zgodovino" on public.zgodovina;
create policy "Dovoli insert v zgodovino" on public.zgodovina
  for insert to authenticated
  with check (public.jp_je_clan_podjetja("ID podjetja"));

-- Samo n8n (service role) piše; politika ni potrebna
drop policy if exists "Termini_Resursi INSERT" on public."Termini_Resursi";
drop policy if exists "customer_portal_tokens INSERT" on public.customer_portal_tokens;

-- Preverjanje po zagonu:
--   select tablename, policyname, cmd, roles, with_check from pg_policies
--   where schemaname='public' and cmd='INSERT'
--     and tablename in ('Resursi','Storitve_Resursi','Termini_Resursi','customer_portal_tokens','zgodovina');
--   -- Resursi, Storitve_Resursi, zgodovina: with_check vsebuje jp_je_clan_podjetja, roles = authenticated
--   -- Termini_Resursi, customer_portal_tokens: brez INSERT politike
-- Nato v aplikaciji: shrani nov vir (Resursi), uredi storitev z viri, uredi termin (zgodovina),
-- in naredi eno spletno rezervacijo (n8n piše Termini_Resursi).
