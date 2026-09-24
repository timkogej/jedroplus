# Več držav – ročni koraki (Tim)

## Supabase
- [ ] Zaženi `supabase/migrations/1790200000_add_company_region.sql` v SQL editorju
      (country_code, timezone, valuta na "Podatki podjetij").
- [ ] Zaženi `supabase/migrations/1790300000_messaging_languages_and_opt_out.sql`
      (angleške različice predlog; marketing_consent + marketing_opt_out_at na "Stranke").
- [ ] Zaženi `supabase/migrations/1790400000_sms_countries_and_log.sql`
      (države za SMS + funkcija `sms_allowed()`, tabela `sms_log`).
- [ ] Zaženi `supabase/migrations/1790500000_receptionist_languages_and_credits.sql`
      (jezik klicatelja, obvestilo o snemanju, varno dodajanje kreditov ob nakupu).
- [ ] Zaženi `supabase/migrations/1790600000_company_vat_verification.sql`
      (vat_verified, vat_verified_at, vat_verified_name na "Podatki podjetij").

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

## Plačila in DDV (Stripe)
Jedro+ **ni zavezanec za DDV** → cene so končne, DDV se ne obračuna.
- [ ] **Ne** vklapljaj Stripe Tax in **ne** nastavljaj `STRIPE_AUTOMATIC_TAX=1`, dokler ne postaneš zavezanec.
- [ ] Stripe → Settings → Invoices: v nogo računa dodaj
      »DDV ni obračunan na podlagi 1. odstavka 94. člena ZDDV-1.«
- [ ] Z računovodjo preveri **identifikacijo za DDV** (78. člen ZDDV-1): potrebna je, ko
      prodajaš storitve podjetjem v drugih državah EU ali kupuješ storitve iz tujine
      (Stripe, Supabase, Vercel, Twilio …), čeprav nisi zavezanec. Takrat na račune tujim
      podjetjem pride še »obrnjena davčna obveznost« in oddajaš rekapitulacijsko poročilo.
- [ ] Ko preideš prag (v SI 60.000 € prometa na leto) in postaneš zavezanec: vklopi Stripe Tax
      + OSS, `STRIPE_AUTOMATIC_TAX=1`, v n8n checkout `automatic_tax` / `tax_id_collection`,
      in zamenjaj besedilo `billing.paketi.vatNote`. Preverjanje DDV številk (VIES) je že pripravljeno.
- [ ] n8n `/billing/checkout/start`: `locale` iz zahteve → Stripe Checkout `locale`.

## Pravni dokumenti
- [ ] Splošni pogoji, politika zasebnosti, pogodba o obdelavi podatkov (DPA) in seznam
      podobdelovalcev (Supabase, Stripe, BulkGate, Twilio, AI ponudnik, e-pošta) v
      sl, en, de, hr, it. Ko so objavljeni, mi pošlji povezave – dodam jih v prijavo in nastavitve.

## Receptionist+ (glasovni del – kjerkoli teče: n8n / Vapi / …)
- [ ] Beri `receptionist_settings.language` (`sl`/`en`/`de`/`hr`/`it`) in nastavi temu jeziku
      prepoznavo govora, glas in pozdrav. Prazen `greeting_text` → privzeti pozdrav za jezik
      (`DEFAULT_GREETING` v `lib/receptionist.ts`).
- [ ] `detect_caller_language = true`: če klicatelj govori drug od teh 5 jezikov, preklopi nanj.
- [ ] `announce_recording = true` (privzeto): **pred** pozdravom povej `recording_notice_text`
      ali privzeto besedilo za jezik (`DEFAULT_RECORDING_NOTICE`). Brez obvestila ne snemaj/prepisuj.
- [ ] Ure in datumi v pogovoru in pri ustvarjanju termina: po `"Podatki podjetij".timezone`.
- [ ] Klicatelja poveži s stranko po številki v E.164 (normaliziraj `From` in `Stranke.telefon`).
- [ ] Odštevanje kreditov za klice naj bo atomarno (`balance_credits = balance_credits - x`),
      ne »preberi → odštej → zapiši«.
- [ ] Telefonske številke za tujino (Twilio): za DE/AT/IT/HR Twilio zahteva regulatorne
      dokumente (naslov, dokazilo o podjetju) – pripravi jih pred prvim tujim salonom.

## Odločitve
- Obstoječe stranke so vse slovenske: kjer jezik ni nastavljen, ostane slovenščina
  (`language` privzeto `'slo'`, migracija 1783550000). Nič ne spreminjamo.
- Obstoječe stranke smejo prejemati marketing, dokler se ne odjavijo
  (`marketing_consent` NULL). Izločene so samo tiste z `marketing_consent = false`
  ali z zapisano odjavo. Opomniki niso marketing in gredo vsem.
- SMS paketi imajo isto ceno povsod; SMS gredo samo v SI, HR, AT, DE, IT
  (tabela `sms_countries` + `lib/sms.ts`). Nova država = vrstica v tabeli + koda v `SMS_COUNTRIES`.
- En SMS = eno sporočilo iz paketa; dolžina in šumniki so že omejeni v aplikaciji.
