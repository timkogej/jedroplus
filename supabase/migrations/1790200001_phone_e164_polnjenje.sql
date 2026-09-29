-- Polnjenje phone_e164 za stranke, ki so v bazi že od prej.
--
-- Loceno od 1790200000 namenoma: prvo migracijo lahko pozenes in preveris,
-- da novi vpisi dobijo pravo obliko, sele nato se dotaknes starih vrstic.
--
-- Kaj se spremeni: NIC od obstojecega. "Telefonska stevilka" se ne pise.
-- Napolni se le novi stolpec phone_e164, ki je bil do zdaj prazen.
--
-- Nazaj: update public."Stranke" set phone_e164 = null;

-- 6) Obstoječe vrstice: napolnimo SAMO novi stolpec.
--    Namenoma ne pišemo v "Telefonska številka" — niti iste vrednosti vase —,
--    da na tabeli ne sprožimo drugih sprožilcev in realtime dogodkov.
--    Za stranke ostane vse tako, kot je bilo; dobijo le nov, dodaten podatek.
update public."Stranke"
  set phone_e164 = public.jp_normalize_phone_for_company(
        "ID Podjetja", "Telefonska številka"
      )
  where "Telefonska številka" is not null
    and phone_e164 is null;

