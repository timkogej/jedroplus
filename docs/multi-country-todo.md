# Več držav – ročni koraki (Tim)

## Supabase
- [ ] Zaženi `supabase/migrations/1790200000_add_company_region.sql` v SQL editorju
      (country_code, timezone, valuta na "Podatki podjetij").

## n8n
- [ ] Opomniki: čas pošiljanja računaj po `"Podatki podjetij".timezone` (ne po času strežnika).
- [ ] Novi telefoni so v E.164 (`+38640123456`), stari po starem – kjer n8n primerja
      številke kot besedilo (dvojniki, iskanje), primerjaj normalizirano.

## Odločitve
- Obstoječe stranke so vse slovenske: kjer jezik ni nastavljen, ostane slovenščina
  (`language` privzeto `'slo'`, migracija 1783550000). Nič ne spreminjamo.
