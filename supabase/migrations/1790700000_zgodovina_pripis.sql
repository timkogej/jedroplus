-- Pripis v zgodovini: kdo je dejansko kaj naredil.
--
-- Sprožilci iz 1790600000 zabeležijo vsak dogodek, pripisati pa znajo le
-- prijavljenega uporabnika. Ker aplikacija v "Termini" neposredno piše samo
-- mehki izbris, vse drugo pa teče skozi n8n s servisnim ključem, je pri skoraj
-- vsem zapisano 'sistem'.
--
-- Kljuka jp.izvedel iz prejšnje migracije tu ne pomaga: nastavitev velja le
-- znotraj iste transakcije, PostgREST pa vsako zahtevo izvede v svoji, in
-- vozlišče Supabase v n8n ne zna poslati niti lastne glave. Zato gre pripis po
-- dogodku: tok po zapisu pokliče to funkcijo in dopolni, kar je sprožilec že
-- zabeležil.
--
-- Funkcija je namenoma skromna:
--   • dopolni samo zapise, ki so še 'sistem' — nikoli ne povozi pravega imena,
--   • seže samo nekaj minut nazaj, da pozen ali podvojen klic ne prepiše
--     starejše zgodovine,
--   • vrne število dopolnjenih vrstic, da tok lahko preveri, ali je zadel.

create or replace function public.jp_zgodovina_pripisi(
  p_company     text,
  p_entiteta    text,
  p_izvedel     text,
  p_izvedel_tip text,
  p_akcija      text default null,
  p_sekund      integer default 120
)
returns integer
language plpgsql
security definer
set search_path = public
as $jp_pripisi$
declare
  DOVOLJENI constant text[] := array['owner', 'admin', 'staff', 'stranka', 'sistem'];
  v_tip     text := lower(btrim(coalesce(p_izvedel_tip, '')));
  v_kdo     text := nullif(btrim(coalesce(p_izvedel, '')), '');
  v_meja    timestamp;
  v_stevilo integer := 0;
begin
  if nullif(btrim(coalesce(p_company, '')), '') is null
     or nullif(btrim(coalesce(p_entiteta, '')), '') is null then
    return 0;
  end if;

  if not (v_tip = any (DOVOLJENI)) then
    raise exception 'jp_zgodovina_pripisi: neveljaven izvedel_tip "%" (dovoljeni: %)',
      p_izvedel_tip, array_to_string(DOVOLJENI, ', ');
  end if;

  -- Okno omejimo, da pozen klic ne pripiše napačnemu dogodku.
  v_meja := (now() at time zone 'utc') - make_interval(secs => greatest(coalesce(p_sekund, 120), 1));

  update public.zgodovina z
     set izvedel     = coalesce(v_kdo, z.izvedel),
         izvedel_tip = v_tip,
         -- Spletna rezervacija je po obliki enaka terminu, ki ga vpiše salon;
         -- loči ju šele to, da je akter stranka.
         akcija = case
                    when v_tip = 'stranka' and z.akcija = 'ustvarjen'
                      then 'online_rezervacija'
                    else z.akcija
                  end
   where z."ID podjetja" = p_company
     and z."ID entitete" = p_entiteta
     and z.created_at    > v_meja
     and z.izvedel_tip   = 'sistem'
     and (p_akcija is null or z.akcija = p_akcija);

  get diagnostics v_stevilo = row_count;
  return v_stevilo;
end;
$jp_pripisi$;

grant execute on function public.jp_zgodovina_pripisi(text, text, text, text, text, integer)
  to authenticated, service_role;
