-- Pripis: ugotovi vlogo iz e-pošte.
--
-- Aplikacija v vsakem klicu proti n8n pošlje `actor` — e-pošto prijavljenega
-- uporabnika (src/lib/n8nClient.ts) — ne pa njegove vloge. `izvedel_tip` pa
-- mora biti owner, admin ali staff, sicer filter na strani Zgodovina ne pomeni
-- nič. Vlogo zna poiskati baza, zato naj jo poišče ona in ne vsak tok posebej.
--
-- Zato tu ena nova vrednost: izvedel_tip = 'auto' pomeni »poglej, kdo je to«.
-- Funkcija e-pošto poveže z uporabnikom in njegovim članstvom v tem podjetju.
-- Če je ne najde — nekdo je bil medtem odstranjen iz ekipe, ali pa je klic
-- prišel od drugod — ostane 'sistem'. Raje nič kot napačen pripis.

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

  -- 'auto': vlogo poiščemo iz e-pošte in članstva v tem podjetju.
  if v_tip = 'auto' then
    if v_kdo is null or v_kdo = 'unknown' then
      return 0;                       -- ni koga pripisati
    end if;

    select lower(cm.role) into v_tip
    from public.company_members cm
    join public.companies co on co.id = cm.company_id
    join auth.users u        on u.id = cm.user_id
    where co."company_id" = p_company
      and lower(u.email) = lower(v_kdo)
    limit 1;

    if v_tip is null or not (v_tip = any (DOVOLJENI)) then
      return 0;                       -- raje nič kot napačen pripis
    end if;
  end if;

  if not (v_tip = any (DOVOLJENI)) then
    raise exception 'jp_zgodovina_pripisi: neveljaven izvedel_tip "%" (dovoljeni: %, ali auto)',
      p_izvedel_tip, array_to_string(DOVOLJENI, ', ');
  end if;

  v_meja := (now() at time zone 'utc') - make_interval(secs => greatest(coalesce(p_sekund, 120), 1));

  update public.zgodovina z
     set izvedel     = coalesce(v_kdo, z.izvedel),
         izvedel_tip = v_tip,
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
