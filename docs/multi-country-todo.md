# Več držav – ročni koraki (Tim)

## Supabase
- [ ] Zaženi `supabase/migrations/1790200000_add_company_region.sql` v SQL editorju
      (country_code, timezone, valuta na "Podatki podjetij").
- [ ] Zaženi `supabase/migrations/1790300000_messaging_languages_and_opt_out.sql`
      (angleške različice predlog; marketing_consent + marketing_opt_out_at na "Stranke").
- [ ] Zaženi `supabase/migrations/1790400000_sms_countries_and_log.sql`
      (države za SMS + funkcija `sms_allowed()`, tabela `sms_log`).

## Vercel (neobvezno)
- [ ] `UNSUBSCRIBE_SECRET` = naključen dolg niz (brez njega se ključ izpelje iz service role ključa).
- [ ] `NEXT_PUBLIC_APP_URL` = javni naslov aplikacije (za povezave za odjavo).

## n8n
- [ ] Opomniki: čas pošiljanja računaj po `"Podatki podjetij".timezone` (ne po času strežnika).
- [ ] Novi telefoni so v E.164 (`+38640123456`), stari po starem – kjer n8n primerja
      številke kot besedilo (dvojniki, iskanje), primerjaj normalizirano.
- [ ] Opomniki z lastno predlogo (`sms_type_* = 'LP'`) in obvestilo o prestavitvi:
      če `Stranke.language` ≠ jezik podjetja (`jezik posiljanja`) in je `*_en` stolpec
      poln (`lastna_predloga_pred_en`, `lastna_predloga_po_en`,
      `obvestilo_prestavitev_template_sms_en`, `obvestilo_prestavitev_template_email_en`),
      pošlji angleško različico; `{{datum}}`/`{{cas}}` takrat oblikuj po angleško.
- [ ] Komunikacija (`/communication/send`): app zdaj pošlje samo stranke, ki smejo
      prejemati marketing, in `data.unsubscribe_urls` (`{ "<client_id>": "https://…/unsubscribe/…" }`).
      V vsako sporočilo dodaj povezavo za odjavo, v e-pošto pa še glavi
      `List-Unsubscribe: <url>` in `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
      (POST na `/api/unsubscribe/<token>`).
- [ ] Registracija strank (`client-registration`): `marketing_consent` iz obrazca zapiši v
      `Stranke.marketing_consent`.

- [ ] SMS (BulkGate) – pred vsakim SMS-om:
      `select sms_allowed(<telefon>, <"Podatki podjetij".country_code>)`.
      Če vrne `false`: pošlji e-pošto namesto SMS-a (če ima stranka e-pošto) in zapiši
      vrstico v `sms_log` s `status = 'blocked_country'`. Paketa ne bremeni.
- [ ] Po vsakem poslanem SMS-u vstavi vrstico v `sms_log`
      (`company_id`, `client_id`, `termin_id`, `phone`, `kind`, `bulkgate_sms_id` = ID iz BulkGate odgovora).
      `kind`: `reminder_before` | `reminder_after` | `reschedule` | `confirmation` | `marketing` | `other`.
- [ ] BulkGate portal: nastavi URL za poročila o dostavi (delivery report webhook) na nov n8n webhook,
      ki po `bulkgate_sms_id` posodobi `sms_log.status` na `delivered` ali `failed` (+ `error`, `updated_at = now()`).
- [ ] BulkGate: preveri, da je ime pošiljatelja (Sender ID) odobreno za HR, AT, DE, IT.

## Odločitve
- Obstoječe stranke so vse slovenske: kjer jezik ni nastavljen, ostane slovenščina
  (`language` privzeto `'slo'`, migracija 1783550000). Nič ne spreminjamo.
- Obstoječe stranke smejo prejemati marketing, dokler se ne odjavijo
  (`marketing_consent` NULL). Izločene so samo tiste z `marketing_consent = false`
  ali z zapisano odjavo. Opomniki niso marketing in gredo vsem.
- SMS paketi imajo isto ceno povsod; SMS gredo samo v SI, HR, AT, DE, IT
  (tabela `sms_countries` + `lib/sms.ts`). Nova država = vrstica v tabeli + koda v `SMS_COUNTRIES`.
- En SMS = eno sporočilo iz paketa; dolžina in šumniki so že omejeni v aplikaciji.
