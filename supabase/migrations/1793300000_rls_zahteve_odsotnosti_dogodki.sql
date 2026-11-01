-- Zapre javni (anonimni) dostop do treh tabel.
--
-- Kdor je imel javni ključ aplikacije (je viden v brskalniku), je lahko bral:
--   zahteve_termini  ime, priimek, e-pošto, telefon in željo stranke
--   absences         razlog in opombo odsotnosti zaposlenih
--   events           dogodke v koledarju vseh podjetij
-- Glavne tabele (Termini, Osebe, Stranke ...) so že zaprte; te tri so ostale odprte.
--
-- Po tej migraciji lahko vrstice bere samo prijavljen član tistega podjetja.
-- Zapisovanje ostane, kot je: aplikacija piše prek n8n (service role, RLS ga ne
-- ustavi), brskalnik tabel ne spreminja. n8n in booking-5 (service role) in
-- Receptionist+ (service role) delujejo naprej.
--
-- Vse tri tabele so po podjetju ključene z besedilnim ID-jem (npr. 7LHB28),
-- članstvo pa je v company_members prek uuid iz tabele companies.

create or replace function public.jp_je_clan_podjetja(p_company_id text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.company_members m
    join public.companies c on c.id = m.company_id
    where c.company_id = p_company_id
      and m.user_id = auth.uid()
  );
$$;

revoke all on function public.jp_je_clan_podjetja(text) from public;
grant execute on function public.jp_je_clan_podjetja(text) to authenticated;

alter table public.zahteve_termini enable row level security;
alter table public.absences enable row level security;
alter table public.events enable row level security;

-- Odstrani morebitne stare odprte politike (imena niso znana, zato po tabelah).
do $$
declare p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('zahteve_termini', 'absences', 'events')
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

create policy zahteve_termini_clani_berejo on public.zahteve_termini
  for select to authenticated
  using (public.jp_je_clan_podjetja("ID podjetja"));

create policy absences_clani_berejo on public.absences
  for select to authenticated
  using (public.jp_je_clan_podjetja(company_id));

create policy events_clani_berejo on public.events
  for select to authenticated
  using (public.jp_je_clan_podjetja(company_id));

revoke all on public.zahteve_termini, public.absences, public.events from anon;

-- Preverjanje po zagonu (vse tri morajo vrniti 0 vrstic):
--   curl -H "apikey: <ANON>" -H "Authorization: Bearer <ANON>" \
--        -H "Prefer: count=exact" -H "Range: 0-0" \
--        "<SUPABASE_URL>/rest/v1/zahteve_termini?select=id"   (in absences, events)
-- Nato v aplikaciji odpri Koledar (odsotnosti, dogodki) in Rezervacije → Zahteve.
