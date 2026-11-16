# Glasovni asistent (Asistent+) — analiza obstoječega sistema

Datum: 12. 11. 2026 · veja `cx/glasovni-asistent-osnova` (iz `origin/main` @ 166d6ed)

Namen: preden zgradimo glasovnega asistenta, natančno popisati, kaj v Jedro+ obstaja, kako tečejo
zapisi in pravice, kaj bo asistent klical in kaj se lahko zlomi. Vse trditve so podprte z datoteko in
vrstico. Kjer nečesa nisem mogel preveriti iz kode, je označeno **(ni preverjeno)**.

Viri, ki sem jih bral: koda v repozitoriju, shema baze (PostgREST OpenAPI, samo metapodatki stolpcev),
lokalne varnostne kopije n8n workflowov v `~/n8n-backup/` (zadnje: 11. 11. 2026). Podatkov strank nisem bral.

---

## 1. Stack in struktura

| Plast | Kaj | Kje |
|---|---|---|
| Frontend | Next.js 16 (App Router), React 19, Tailwind v4, next-intl (sl/en/de/hr/it), PWA | `package.json`, `app/[locale]/…`, `proxy.ts` |
| Strežniško branje | Vzorec `*.server.ts`: strežniški nalagalnik z uporabnikovo **piškotkovo sejo**, zato velja RLS (`auth.uid()`) | `lib/clients/fetchClientsData.server.ts:1-20`, `lib/calendar/fetchCalendarData.server.ts`, `lib/appointments/fetchAppointmentsData.server.ts` |
| Brskalniško branje | `supabaseReadOnly` — proxy, ki prepove `insert/update/delete/upsert/rpc` | `src/lib/supabaseReadOnly.ts:5-29` |
| Zapisi | **Vsi poslovni zapisi gredo prek n8n**: brskalnik → `POST /api/webhook` → n8n `main_povezava` → podworkflow „Vpisovanje podatkov“ (service role) | `src/lib/n8nClient.ts:40-118`, `app/api/webhook/route.ts:31-120`, `README.md` „Supabase write policy“ |
| Izjeme pri zapisih | Nekatere API poti pišejo neposredno s service role (nastavitve, regija, predloge, odjava od trženja, Receptionist+) | `lib/auth/ownerAccess.ts:9-14`, `lib/marketingConsent.server.ts:47-58` |
| Baza | Supabase Postgres, 77 tabel/pogledov, 51 RPC. V repozitoriju so le novejše migracije (`supabase/migrations/`, od 1779…); osnovna shema ni v gitu | `supabase/migrations/` |
| Avtentikacija | Supabase Auth, piškotki (`@supabase/ssr`), Bearer kot rezerva | `lib/auth/apiAuth.ts:52-80`, `lib/supabaseServer.ts` |
| Večnajemniškost | `companies.id` (uuid) ↔ `companies.company_id` (besedilni ID, npr. „7LHB28“); poslovne tabele uporabljajo besedilni ID v stolpcu `ID podjetja`/`ID Podjetja` (različno pisano!) | `lib/companyScope.ts:3-9`, `lib/auth/apiAuth.ts:91-133` |
| Vloge | `company_members.role` ∈ owner/admin/staff; zaposleni dobijo pravice iz **ene vrstice na podjetje** v `staff_role_permissions` (ne po osebi) | `types/roles.ts:1-43`, `lib/supabase/companyMembers.ts:47-59` |
| Lokacije | Do 3 pri Pro; `Lokacije`, `Clani_Lokacije` (omejitev člana), `Osebe_Lokacije`; RLS `jp_ima_dostop_do_lokacije` | `supabase/migrations/1793400005_lokacije_rls_omejitve.sql:31-71`, `lib/auth/locationAccess.ts` |
| Hitrostna omejitev | Upstash, **po IP**, ob napaki ali brez nastavitve **spusti zahtevo skozi** | `lib/rateLimit.ts:24-32, 60-74` |
| Obstoječi LLM | `@anthropic-ai/sdk`, model `claude-haiku-5-5`, samo predlog navodil za Receptionist+ | `app/api/receptionistplus/instructions-suggest/route.ts:20-90` |
| Testi | **V projektu ni testnega ogrodja** (ni `test` skripte, ni vitest/jest) | `package.json:5-11` |

## 2. Domenski model (relevantni stolpci)

| Tabela | Ključni stolpci | Opombe |
|---|---|---|
| `Stranke` | `id` (bigint), `ID stranke` (7 števk), `ID Podjetja`, `Ime`, `Priimek`, `Stranka`, `Telefonska številka`, `phone_e164`, `Email stranke`, `Opombe stranke`, `Interne opombe`, `Zadnja interakcija`, `Status`, `Obvestimo`, `marketing_consent` (null = brez privolitve), `marketing_opt_out_at`, `language` | Opombe so en prost tekst, brez zgodovine in brez strukture (barva, odtenek …) |
| `Termini` | `ID termina` (8 števk), `ID podjetja`, `ID stranke`, `Datum` (date), `Čas`/`Konec` (time, **lokalni čas brez pasu**), `Storitev`, `ID storitve` (+2, +3), `Oseba`, `ID Osebe`, `Status` (prost tekst sl/en), `lokacija_id`, `deleted_at`, `Interne opombe` | Status beremo z `lib/appointments/status.ts:9-20` |
| `Storitve` | `ID storitve`, `Naziv`, `Kategorija`, `Trajanje`, `Skupno trajanje`, `Buffer pred/po` (vse besedilo!), `Status`, `can_book_online` | Trajanje je besedilo — treba ga je razčleniti |
| `Osebe` | `ID osebe`, `Ime`, `Priimek`, `Urnik` (JSON v besedilu), `Storitve`, `Status`, `auth_user_id` | `company_members.person_id` → `Osebe.id` |
| `Resursi`, `Termini_Resursi`, `Storitve_Resursi` | Kapaciteta, količina, urnik | Zasedenost resursov se ob rezervaciji **ne preverja** (znano tveganje iz analize Receptionist+) |
| `absences`, `events` | Odsotnosti zaposlenih, dogodki/blokade (`enable_booking`) | RLS po članstvu + lokaciji (`1793300000`, `1793400005`) |
| `Podatki podjetij` | 137 stolpcev; `urnik` (JSON), `timezone`, `language`, `jezik posiljanja`, `Naziv Podjetja` | Časovni pas podjetja; privzeto Europe/Ljubljana (`lib/timezone.ts:13`) |
| `plans`, `company_subscriptions` | `assistant_enabled` (že obstaja!), kvote SMS/e-pošte, `max_locations` | Stolpec `assistant_enabled` je ostanek starega Asistent+ |
| `company_sms_usage`, `ll_reserve_company_sms_quota` … | Rezervacija/potrditev porabe SMS | Vzorec rezerviraj → potrdi, ki ga ponovno uporabimo za ukaze |
| `zgodovina` | Revizijska sled sprememb terminov/strank (`jp_zgodovina_*`, sprožilci) | `1790600000_zgodovina_sprozilci.sql`, `1790700000_zgodovina_pripis.sql` |
| `consent_records`, `email_opt_out` | Privolitve | Pravilo: null ≠ privolitev |
| `PendingAkcije`, `Pogovori` | Ostanek starega Asistent+ (n8n „asistent“ workflow, besedilni klepet) | Ni več v uporabi v aplikaciji (Asistent+ odstranjen v ceniku 2026) |
| Paketi, zvestoba | `loyalty_*`, `pos_*` | Izven obsega (brez plačil) |

Čakalna lista/prosti termini za stranke: še ne obstaja (le načrt `docs/prosti-termini-nacrt.md`).
Spletna rezervacija: n8n „Booking v2“ (`booking-v2`), računanje prostih terminov je v n8n, ne v aplikaciji.

## 3. Funkcije, ki jih bo asistent klical ali jih lahko prizadene

Legenda tveganja: R = branje, W = zapis, M = množično, S = pošiljanje sporočil.

| # | Funkcija | Koda | Pravice danes | Stranski učinki | Robna stanja / tveganja | Predlog |
|---|---|---|---|---|---|---|
| 1 | Iskanje stranke | `lib/supabase/clients.ts:259` (`searchClients`), RPC `jp_find_client` | RLS: član podjetja. **`can_view_clients` se preverja samo v vmesniku** | – | 699+ strank; imena v sklonih; dvojniki (`1790400000_iskanje_dvojnikov.sql`) | R. Novo: fuzzy iskanje na strežniku z uporabnikovo sejo, vrne ≤5 kandidatov; preveri `can_view_clients` v asistentu |
| 2 | Opomba/preferenca na kartici | `ClientsClient.tsx:389-416` → `POSODOBITEV_STRANKE` → n8n „Posodobi stranko“ | Član podjetja; `can_edit_clients` samo v vmesniku (`ClientsClient.tsx:173`) | n8n **vedno** nastavi `Obvestimo="DA"` in `Status="aktivna"`, prepiše ime/e-pošto/telefon na **vseh terminih** stranke, zapiše zgodovino | **n8n ne zapiše `Interne opombe`** (polje v vozlišču manjka) → urejanje internih opomb v aplikaciji se tiho izgubi. Pošlje se cela vrstica → zadnji zapis zmaga (izguba sočasnih sprememb). `phone.replace` pade, če telefona ni | W. Ne gremo prek `POSODOBITEV_STRANKE`. Nova tabela `stranke_zapiski` (samo dodajanje, z avtorjem in časom), RLS preverja članstvo **in** `can_edit_clients`. Napako v n8n poročam ločeno |
| 3 | Branje koledarja | `lib/calendar/fetchCalendarData.server.ts`, `lib/appointments/fetchAppointmentsData.server.ts` | RLS: član + lokacija (`termini_lokacije_omejitev`). `can_view_only_own_appointments` **ni v RLS** | – | `Datum`+`Čas` brez pasu; `deleted_at`; status prosti tekst; „Ghost“ termini (`belezi_termin`) | R. Uporabniška seja (RLS), dodatno filtriraj „samo svoje“ v asistentu |
| 4 | Prvi prosti termin | Ni v aplikaciji; v n8n (Booking v2, „Get free slots“) | – | – | Urnik podjetja + urnik osebe (lahko izmenični, `lib/utils/urnik.ts:4-31`), odsotnosti, dogodki z `enable_booking=false`, bufferji, resursi, lokacije, poletni čas | R. Poenostavljen izračun v asistentu (urnik osebe/podjetja, termini, odsotnosti); odgovor označen kot „predlog, preveri v koledarju“. Resursov v 1. izdaji ne upošteva — jasno zapisano |
| 5 | Zadnji obisk stranke | `Stranke."Zadnja interakcija"`, `getClientWithAppointments` (`clients.ts:307`) | RLS | – | Status „completed“ vs. prihodnji | R |
| 6 | Nov termin | `NOV_TERMIN` (`Calendar.tsx:1310`, `AppointmentsClient.tsx:405`) → n8n | Član + lokacija (`locationAccess.ts`); `can_create_appointments` samo v vmesniku | **Pošlje potrdilo SMS/e-pošto** (n8n: „Pošlji potrdilo?“, outbox, kvota) | Prekrivanje se v n8n ne preverja (ni preverjeno za vse veje); resursi ne; 8-mestni ID iz odjemalca (`src/lib/idGenerators.ts`) | Faza 2, W+S. Ogrodje rezervirano, nepovezano |
| 7 | Prestavitev termina | `POSODOBITEV_TERMINA` + ločen `PRESTAVITEV_TERMINA_OBVESTILO` (`app/api/webhook/route.ts:14-27`) | Kot zgoraj | Posodobitev sama ne obvesti; obvestilo je ločen dogodek → workflow „PRESTAVITEV TERMINA“ | Dve ločeni klicni poti = možno pol-izvedeno (premaknjeno, ni obveščeno) | Faza 2/3, W+S, potrditev pokaže oboje |
| 8 | Preklic termina | `ODPOVED_TERMINA` (`DashboardClient.tsx:553`, `Calendar.tsx:1113`) | Kot zgoraj; `can_delete_appointments`? | n8n samo označi „odpovedal“ — **SMS o preklicu se ne pošlje** | „Prekliči in obvesti stranke“ potrebuje novo pot za obvestilo | Faza 3 |
| 9 | Blokada / odsotnost | `ODSOTNOST`, `UREDI_ODSOTNOST`, `USTVARI_DOGODEK` | Član | – | Obstoječi termini v blokadi se ne premaknejo | Faza 2 |
| 10 | Nova stranka | `NOVA_STRANKA` (`ClientsClient.tsx:430-460`) | `can_create_clients` samo v vmesniku | Ni sporočil (ni preverjeno za vse veje) | Dvojniki; 7-mestni ID iz odjemalca, ob trku ponovi | Faza 2 |
| 11 | Množično premikanje + SMS | Ne obstaja | – | M+S | Kvota SMS, dva termina isti dan = dva SMS (namenoma), transakcijsko vs. marketinško | Faza 3: ena potrditev, izvedba po vrsti z dnevnikom in delnim poročilom |
| 12 | Pošiljanje sporočila | `POSLJI_SPOROCILO`, `GENERIRAJ_SPOROCILO` (komunikacija) | `can_access_komunikacija` | S, marketinško | Privolitev: `marketing_consent=null` → ne pošiljamo | Asistent v 1. izdaji **ne pošilja** sporočil |
| 13 | Zgodovina sprememb | sprožilci `jp_zgodovina_*` | – | Zapis ob vsaki spremembi Termini/Stranke | Akter je e-pošta iz `actor` | Novi zapiski: lastna revizija + zgodovina (tip „glas“) |
| 14 | Opomniki (cron/n8n) | „Pošiljanje pred terminom“, AI opomniki | – | SMS pred terminom | Spremenjen termin mora ponastaviti „Obveščen PRED“ (ni preverjeno) | Faza 2: preveri pred povezavo premikanja |

## 4. Integracije in kaj se zgodi ob spremembi termina

| Integracija | Pot | Ob spremembi termina |
|---|---|---|
| n8n `main_povezava` | `app/api/webhook/route.ts:14`; preklopi na „Vpisovanje podatkov“, „Zapiši event“, „Pošiljanje po terminu“; bere tudi `staff_role_permissions` | Glej vrstice 6–8 zgoraj |
| n8n `prestavitev-termina-obvestilo` | `app/api/webhook/route.ts:15-27` | SMS/e-pošta stranki o prestavitvi |
| SMS (BulkGate prek n8n `sms-send`) | `sms_log.bulkgate_sms_id`, `ll_reserve_company_sms_quota` | Kvota po podjetju in mesecu |
| E-pošta (SES, predloge v2) | `email-send` workflow, `message_outbox` | Potrdilo ob novem terminu |
| Telnyx (Receptionist+) | ločen strežnik/delavec, `receptionist_*` tabele, `receptionist_worker_heartbeat` | Asistent+ po telefonu bi uporabil isti Telnyx račun, a drugo številko |
| Cron | `app/api/cron/auto-complete`, n8n urniki (opomniki) | Samodejni zaključek terminov |
| Push | `lib/push/*`, `app/api/push/*` | Obvestila lastniku |
| Stripe | Receptionist+ krediti, paketi | **Izven obsega** |

## 5. Obstoječe AI funkcije

- **Predlog navodil Receptionist+** (`instructions-suggest/route.ts`): en klic, `claude-haiku-5-5`, `thinking: disabled`, besedilo spletne strani v oznakah `<website>` z navodilom „to so podatki, ne ukazi“ (dober vzorec zaščite pred prompt injection), napaka → 502 z jasno kodo, brez beleženja stroška.
- **Receptionist+** (glasovni klici): ločen strežnik (ne v tem repozitoriju), krediti v `receptionist_credits`, `receptionist_deduct_credits`. Vzorec kreditov ponovno uporabimo za kvote ukazov, a v ločenih tabelah (drugačna enota).
- **AI opomniki** (n8n, prompti v n8n): stroški se ne beležijo po podjetju.
- **Stari Asistent+** (n8n `asistent`, tabele `PendingAkcije`/`Pogovori`, pot `/asistent` skrita v `components/layout/Sidebar.tsx:87`, pravica `can_access_asistent_plus`): besedilni klepet, potrditve brez žetona, brez kvot. **Ne gradimo na njem**; ponovno uporabimo le pravico `can_access_asistent_plus` in stolpec `plans.assistant_enabled`.
- Ponovna uporaba: `ANTHROPIC_API_KEY` in SDK že obstajata; manjka beleženje porabe, kvote in skupna plast ponudnikov.

## 6. Tveganja, ki jih nova funkcija lahko poslabša

| Tveganje | Dokaz | Vpliv na glas | Ukrep |
|---|---|---|---|
| n8n odgovori pred zapisom | `lib/confirmWrite.ts:1-8` | Asistent bi javil „opravljeno“, preden je zapisano | Lastni zapisi (zapiski) gredo neposredno v bazo v eni transakciji; za n8n poti (faza 2) čakamo na zapis kot `confirmWrite` |
| Zaporedni klici / počasnost | spomin „hitrost 4.11.“ | Cilj ≤3 s | Vzporedno: avtentikacija + kvota + namigi; LLM samo, ko je treba |
| Hitrostna omejitev po IP in „fail open“ | `lib/rateLimit.ts:60-74` | En salon = en IP za več zaposlenih; ob izpadu Redis neomejeno | Lastna omejitev po uporabniku + trda kvota v bazi (fail closed) |
| Pravice zaposlenih le v vmesniku | `ClientsClient.tsx:173`, ni zadetkov `staff_role_permissions` v migracijah | Glas bi zaobšel pravice | Pravice preverja asistent na strežniku **in** RLS na novih tabelah |
| `resolveUserCompany` z `.maybeSingle()` brez filtra podjetja | `lib/auth/apiAuth.ts:99-105` | Uporabnik v dveh podjetjih → napaka → 403 | Asistent uporabi isto funkcijo (enako obnašanje kot drugje); zapisano kot odprto vprašanje |
| Ni zasedenosti resursov | analiza Receptionist+ | Prvi prosti termin je lahko napačen | V odgovoru označi; faza 2 ne ustvarja terminov brez preverjanja |
| Nadzor na istem strežniku, ni healthchecks | spomin „Receptionist+ tveganja“, „Opomnik healthchecks“ | Izpad ponudnika STT/LLM neopažen | Metrike napak v bazi + opozorilo; healthchecks ping iz Vercel crona (ločen sistem) |
| SMS ob preklicu se ne pošlje | n8n `ODPOVED_TERMINA` → samo „Označi, da je odpovedal“ | „Prekliči in obvesti“ bi tiho ne obvestil | Faza 3 potrebuje novo obvestilo |
| `POSODOBITEV_STRANKE` ponastavi `Obvestimo`/`Status` | n8n „Posodobi stranko“ | Glas bi lahko znova vklopil obveščanje stranke, ki ga je izklopila | Asistent te poti ne uporablja |

## 7. Kaj manjka ali je krhko (popraviti ali zaobiti)

1. **Napaka (obstoječa):** n8n ne shrani `Interne opombe` stranke → urejanje v aplikaciji se izgubi. Popravek: dodaj polje v vozlišče „Posodobi stranko“ (n8n, ne koda). Ne popravljam sam (n8n spremembe zahtevajo tvojo potrditev).
2. **Napaka (obstoječa):** „Posodobi stranko“ vedno nastavi `Obvestimo="DA"` in `Status="aktivna"`. Predlog: polji pošiljaj iz obrazca ali ju ne prepisuj.
3. `staff_role_permissions` ni uveljavljen na strežniku/v RLS za obstoječe poti — splošna vrzel, izven obsega; asistent jo zaobide s svojo plastjo pravic.
4. Ni testnega ogrodja → dodam `vitest` (samo devDependency) in skripto `npm test`.
5. Osnovna shema baze ni v gitu → migracije asistenta so samostojne in idempotentne (`create … if not exists`).
6. Hitrostna omejitev „fail open“ → za glas dodam omejitev po uporabniku v bazi (atomarno), ki ne potrebuje Redisa.

## 8. Odprta vprašanja zate (s privzeto izbiro, po kateri delam)

| # | Vprašanje | Privzeto (označeno) |
|---|---|---|
| 1 | Kje hranimo glasovne zapiske strank? | **Nova tabela `stranke_zapiski`** (kategorije: barva, preferenca, opomba), prikaz na kartici v naslednjem koraku. Ne v `Interne opombe` (glej 7.1) |
| 2 | Kvote: Asistent+ 400/mes, Pro? | Asistent+ 400, Pro **1000** (privzeto), Free/Plus brez dodatka 0 |
| 3 | Kdo sme uporabljati glas? | Lastnik in admin vedno (če je podjetju vklopljeno); zaposleni samo z `can_access_asistent_plus`; lastnik lahko izklopi posameznika |
| 4 | STT ponudnik | Odloči testni set; privzeto ElevenLabs Scribe (podpira sl in ključne besede) |
| 5 | Hramba prepisov | Zvok se **ne shrani**; prepis 30 dni, nato se izbriše (rok nastavljiv) |
| 6 | Uporabnik v več podjetjih | Enako kot ostala aplikacija (eno podjetje na uporabnika) |
| 7 | Kategorija „barva“ — ali naj bodo recepture strukturirane (odtenek, gramatura, oksidant, čas)? | Da, kot JSON polje `podrobnosti` poleg besedila; LLM izlušči, prikaz besedila je vir resnice |
| 8 | Ali smem popraviti n8n (7.1, 7.2)? | Ne brez tebe — samo poročam |
