-- Več lokacij na podjetje, 6. del: pravice po lokacijah v bazi.
--
-- Do zdaj so bile lokacije omejene samo v vmesniku. Ta migracija doda pravilo v
-- bazo: član, ki mu je dostop omejen na nekatere lokacije (vrstice v
-- "Clani_Lokacije"), ne more brati termine, vire, dogodke in zahteve drugih
-- lokacij, tudi če pokliče bazo mimo aplikacije.
--
-- Pravila:
--   lastnik                              vidi vse lokacije
--   član brez vrstic v Clani_Lokacije    vidi vse lokacije (kot do zdaj)
--   član z vrsticami                     vidi samo dodeljene lokacije
--   vrstica brez lokacije (events)       velja za vse lokacije, vidijo jo vsi člani
--
-- Politike so RESTRICTIVE: z obstoječimi (PERMISSIVE) se zdaj ne seštevajo, ampak
-- se morajo izpolniti obe. Obstoječih politik ne spreminjam in jih ni treba
-- poznati: kdor je že imel dostop, ga ima naprej, razen do lokacij, ki mu niso
-- dodeljene. n8n, booking-5, portal in Receptionist+ uporabljajo service role,
-- ki RLS obide, zato delujejo nespremenjeno.
--
-- Podjetje z eno lokacijo: nihče nima vrstic v Clani_Lokacije, zato se nič ne
-- spremeni.
--
-- Zaženi ročno v Supabase SQL editorju. Varno za ponovni zagon.
-- Razveljavitev: spodaj, razdelek "Nazaj".

-- ───────────────────────────────────────────────────────────────────────────
-- Dostop do lokacije (nadomesti funkcijo iz 1793400002; ista oznaka, isti klici)
--   p_lokacija is null  -> vrstica velja za vse lokacije, zadošča članstvo
--   lastnik             -> vse lokacije
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.jp_ima_dostop_do_lokacije(p_company text, p_lokacija uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.company_members m
    join public.companies c on c.id = m.company_id
    where c.company_id = p_company
      and m.user_id = auth.uid()
      and (
        m.role = 'owner'
        or p_lokacija is null
        or not exists (select 1 from public."Clani_Lokacije" cl
                       where cl.user_id = m.user_id and cl.company_id = c.id)
        or exists (select 1 from public."Clani_Lokacije" cl
                   where cl.user_id = m.user_id and cl.company_id = c.id
                     and cl.lokacija_id = p_lokacija)
      )
  );
$$;

revoke all on function public.jp_ima_dostop_do_lokacije(text, uuid) from public;
grant execute on function public.jp_ima_dostop_do_lokacije(text, uuid) to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- Termini, dogodki, zahteve: branje samo dodeljenih lokacij
-- ───────────────────────────────────────────────────────────────────────────
drop policy if exists termini_lokacije_omejitev on public."Termini";
create policy termini_lokacije_omejitev on public."Termini"
  as restrictive for select to authenticated
  using (public.jp_ima_dostop_do_lokacije("ID podjetja", lokacija_id));

drop policy if exists events_lokacije_omejitev on public.events;
create policy events_lokacije_omejitev on public.events
  as restrictive for select to authenticated
  using (public.jp_ima_dostop_do_lokacije(company_id, lokacija_id));

drop policy if exists zahteve_termini_lokacije_omejitev on public.zahteve_termini;
create policy zahteve_termini_lokacije_omejitev on public.zahteve_termini
  as restrictive for select to authenticated
  using (public.jp_ima_dostop_do_lokacije("ID podjetja", lokacija_id));

-- ───────────────────────────────────────────────────────────────────────────
-- Resursi: aplikacija jih piše neposredno, zato omejitev velja za vse ukaze
-- ───────────────────────────────────────────────────────────────────────────
drop policy if exists resursi_lokacije_omejitev on public."Resursi";
create policy resursi_lokacije_omejitev on public."Resursi"
  as restrictive for all to authenticated
  using (public.jp_ima_dostop_do_lokacije("ID podjetja", lokacija_id))
  with check (public.jp_ima_dostop_do_lokacije("ID podjetja", lokacija_id));

-- ───────────────────────────────────────────────────────────────────────────
-- Preverjanje po zagonu (kot lastnik; vse mora vrniti true / število brez napake):
--   select polname, polpermissive from pg_policy
--   where polname like '%lokacije_omejitev';          -- 4 vrstice, polpermissive = false
--   select count(*) from "Termini";                    -- enako kot prej
--
-- Preizkus omejenega člana (zamenjaj UUID-je; vse znotraj transakcije):
--   begin;
--     insert into "Clani_Lokacije" (company_id, user_id, lokacija_id)
--       values ('<companies.id>', '<auth uid člana>', '<lokacija A>');
--     set local role authenticated;
--     select set_config('request.jwt.claims', '{"sub":"<auth uid člana>"}', true);
--     select lokacija_id, count(*) from "Termini"
--       where "ID podjetja" = '<ID podjetja>' group by 1;   -- samo lokacija A
--   rollback;
--
-- Nazaj (vrne stanje pred to migracijo):
--   drop policy termini_lokacije_omejitev on public."Termini";
--   drop policy events_lokacije_omejitev on public.events;
--   drop policy zahteve_termini_lokacije_omejitev on public.zahteve_termini;
--   drop policy resursi_lokacije_omejitev on public."Resursi";
--   (funkcija jp_ima_dostop_do_lokacije ostane; za prejšnjo različico znova
--    zaženi razdelek "Dostop do lokacije" iz 1793400002)
-- ───────────────────────────────────────────────────────────────────────────
