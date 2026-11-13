-- Asistent+: fokus pogovora (aktivna stranka in termin).
--
-- glas_ukazi.kontekst hrani samo ID-je, npr. {"stranka_id":"ABC-12345","termin_id":"T-1","termin_datum":"2026-11-14"}.
-- Brez imen, telefonov ali e-pošte. Strežnik ga prebere samo za istega uporabnika in podjetje
-- (zadnjih 5 minut). ID je le namig: orodja stranko in termin vedno znova preberejo z
-- uporabnikovo sejo (RLS). Piše samo service role prek jp_glas_zakljuci_ukaz.
-- Idempotentno: ponoven zagon ne pade.

alter table public.glas_ukazi add column if not exists kontekst jsonb;

-- Zaključi ukaz: enako kot v 1793500000, dodatno zapiše kontekst.
create or replace function public.jp_glas_zakljuci_ukaz(p_ukaz uuid, p_podatki jsonb, p_vrni_kvoto boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_ukaz  public.glas_ukazi%rowtype;
  v_mesec date;
begin
  select * into v_ukaz from public.glas_ukazi where id = p_ukaz for update;
  if not found or v_ukaz.zakljucen_at is not null then
    return;
  end if;
  v_mesec := date_trunc('month', v_ukaz.created_at at time zone 'Europe/Ljubljana')::date;

  update public.glas_ukazi set
    status               = coalesce(p_podatki->>'status', status),
    prepis               = p_podatki->>'prepis',
    odgovor              = p_podatki->>'odgovor',
    orodja               = coalesce((select array_agg(x) from jsonb_array_elements_text(p_podatki->'orodja') x), '{}'),
    napaka_koda          = p_podatki->>'napaka_koda',
    stt_ponudnik         = p_podatki->>'stt_ponudnik',
    stt_sekunde          = coalesce((p_podatki->>'stt_sekunde')::numeric, 0),
    llm_ponudnik         = p_podatki->>'llm_ponudnik',
    llm_model            = p_podatki->>'llm_model',
    llm_vhod             = coalesce((p_podatki->>'llm_vhod')::int, 0),
    llm_vhod_predpomnjen = coalesce((p_podatki->>'llm_vhod_predpomnjen')::int, 0),
    llm_izhod            = coalesce((p_podatki->>'llm_izhod')::int, 0),
    tts_znaki            = coalesce((p_podatki->>'tts_znaki')::int, 0),
    strosek_mikro_usd    = coalesce((p_podatki->>'strosek_mikro_usd')::numeric, 0),
    trajanje_ms          = coalesce(p_podatki->'trajanje_ms', '{}'::jsonb),
    kontekst             = case when jsonb_typeof(p_podatki->'kontekst') = 'object' then p_podatki->'kontekst' else null end,
    steje_v_kvoto        = steje_v_kvoto and not p_vrni_kvoto,
    zakljucen_at         = now()
  where id = p_ukaz;

  update public.glas_poraba_mesec set
    ukazi                = ukazi - case when p_vrni_kvoto and v_ukaz.steje_v_kvoto then 1 else 0 end,
    stt_sekunde          = stt_sekunde + coalesce((p_podatki->>'stt_sekunde')::numeric, 0),
    llm_vhod             = llm_vhod + coalesce((p_podatki->>'llm_vhod')::int, 0),
    llm_vhod_predpomnjen = llm_vhod_predpomnjen + coalesce((p_podatki->>'llm_vhod_predpomnjen')::int, 0),
    llm_izhod            = llm_izhod + coalesce((p_podatki->>'llm_izhod')::int, 0),
    tts_znaki            = tts_znaki + coalesce((p_podatki->>'tts_znaki')::int, 0),
    strosek_mikro_usd    = strosek_mikro_usd + coalesce((p_podatki->>'strosek_mikro_usd')::numeric, 0),
    updated_at           = now()
  where company_id = v_ukaz.company_id and mesec = v_mesec;
end;
$$;

revoke all on function public.jp_glas_zakljuci_ukaz(uuid, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.jp_glas_zakljuci_ukaz(uuid, jsonb, boolean) to service_role;
