# Več lokacij na podjetje: analiza (1. 11. 2026)

Stanje: samo analiza, nič ni spremenjeno v kodi ali bazi. Pregledano: Jedro+ (`~/dev/jedroplus`), booking-5, portal, n8n workflowi (`~/n8n-backup`, zadnja kopija vsakega) in Receptionist+ worker. Politik RLS v bazi nisem mogel videti (niso v repozitoriju), zato so označene kot "preveriti".

## 1. Mnenje o paketu

**Predlog: lokacije so vključene v Jedro Pro, do 3 lokacije (glavna + 2 dodatni). Plus in Free imata 1 lokacijo. Za več kot 3: dodatek ali Enterprise.**

- Lokacij ne zaračunavamo posebej, ker se prihodek že skalira z osebjem: dodatna prijava (6 €/mes) je omejena po podjetju, ne po lokaciji. Veriga s 3 lokacijami ima več ljudi in plača več mest.
- Omejitev (3) rabimo, ker so SMS/email kvote in Receptionist+ krediti skupni, vsaka lokacija z lastno telefonsko številko pa stane (Telnyx). Neomejeno v Pro bi pomenilo verigo s 15 lokacijami za 29,90 €.
- Tehnično: skupna omejitev = `plans.max_locations` + `extra_locations` (doplačilo). Vzorec je isti kot pri zaposlenih (`max_employees` + `company_user_limits.extra_users`). Preverjanje je **na strežniku** ob ustvarjanju lokacije, ne le v vmesniku.
- **Doplačilo (Tim potrdil 1. 11.):** podjetje lahko doplača dodatne lokacije. Nov paket z npr. 5 lokacijami je samo nova vrstica v `plans`. V kodi ni trdo zapisane številke 3; besedila in primerjava paketov jo berejo iz podatkov.
- Tabela `company_location_limits`: `extra_locations`, ID Stripe postavke, `cancel_at_period_end`. Nova Stripe cena (`STRIPE_LOCATION_PRICE_ID`), workflowa za nakup in odpoved dodatka po vzoru obstoječih, vmesnik v Nastavitvah → Dodatki. Cena dodatka še ni določena (dodatna prijava je 6 €/mes).
- **Odpoved dodatka ali padec paketa**: če je lokacij več, kot je dovoljeno, lastnik ob koncu obdobja sam izbere, katere ostanejo; ostale se arhivirajo. Do konca obdobja vse deluje. Pri nadgradnji se arhivirane lokacije ne obnavljajo samodejno.
- Receptionist+ številke po lokaciji so ločen strošek, ne del dodatka.
- **Padec paketa (Pro → Plus)**: lokacij ne brišemo. Ena ostane aktivna (glavna), druge se arhivirajo: stari termini in zgodovina ostanejo, spletna rezervacija in koledar jih ne kažeta več. To mora biti odločeno vnaprej.

## 2. Glavna arhitekturna odločitev

| | A: lokacije znotraj podjetja (predlog) | B: vsaka lokacija svoje podjetje + skupina |
|---|---|---|
| Stranke, točke zvestobe, portal | skupni | ločeni (stranka bi imela N profilov) |
| Paket / račun | en | N paketov, združevanje računov |
| Spletna rezervacija | en link, izbira lokacije | N linkov |
| Dela | veliko | manj, a daje napačen izdelek |

Predlagam **A**. Dobra novica: podjetje je že osrednji ključ povsod, `Termini`/`Osebe`/`Resursi` že imajo stolpec podjetja. Slaba: pol sistema je napisano z samodejnim iskanjem imen stolpcev in nastavljivimi imeni tabel (`lib/companyScope.ts`, "Tabela termini" ...), zato mora nov stolpec obstajati v vseh tabelah, ki jih podjetja dejansko uporabljajo.

**Zlato pravilo: podjetje z eno lokacijo ne sme videti nobene spremembe** (brez novega koraka, filtra, stolpca). Vse se pokaže šele pri 2+ aktivnih lokacijah.

**Varnostna mreža pri uvajanju (expand/contract):** vsako obstoječe podjetje dobi eno "glavno" lokacijo (prepis `Naslov podjetja`, `Kontaktni telefon`, `urnik`). Trigger v bazi vsakemu `Termini` brez `lokacija_id` samodejno dodeli glavno lokacijo. Tako n8n workflowi, worker in portal še delujejo, ko jih še nismo posodobili. Stara polja v `Podatki podjetij` ostanejo kot rezerva in so sinhronizirana z glavno lokacijo, dokler zadnji workflow ni prestavljen.

## 3. Podatkovni model

Nove tabele:

- `Lokacije`: id, podjetje, naziv, **govorno_ime in vzdevki** (za Receptionist+, ker se imena sklanjajo: "v Mariboru"), naslov, mesto, pošta, država (za praznike), telefon, email, `urnik` (odpiralni čas lokacije), status (aktivna/arhivirana), `je_glavna`, vidna_v_bookingu, vrstni_red, slug (za povezave), povezava_ocena (vsaka lokacija ima svoj Google profil), opis in navodila (parking ...).
- `Osebe_Lokacije`: oseba, lokacija, **urnik na lokacijo**, "uporablja urnik lokacije".
- `Storitve_Lokacije`: storitev, lokacija (brez vrstic = povsod, da ostane združljivo).
- `Clani_Lokacije`: član podjetja, lokacija (za omejene admine/vodje).

Novi stolpci: `Termini.lokacija_id` (+ indeks), `Resursi.lokacija_id` (vsak resurs pripada eni lokaciji), `events.lokacija_id` (NULL = vse lokacije), `zahteve_termini.lokacija_id`, `receptionist_phone_numbers.lokacija_id`, `receptionist_calls.lokacija_id`, `message_outbox`/`zgodovina` po potrebi, `plans.max_locations`, tabela `company_location_limits`.

Ostane na ravni podjetja: stranke, zvestoba, popusti/happy hour (v1), kvote SMS/email/krediti, Stripe, pravila odpovedi, jezik, `koledar_ure`, `max_dnevi_rezervacija`, predloge sporočil (vsebina; naslov in telefon se vstavita iz lokacije termina).
Ostane na ravni osebe: odsotnosti (`absences`), veljajo na vseh lokacijah.

## 4. Kritične tehnične pasti (najdeno v kodi)

1. **Resursi v izračunu terminov.** `Slots: Generate` in `Create: Resolve` vzameta *vse* resurse, povezane s storitvijo, in zavrneta termin, če je *kateri koli* poln. Pri dveh lokacijah z vsako svojo kabino za isto storitev bi polna kabina v Mariboru blokirala Ljubljano. Treba je filtrirati resurse po izbrani lokaciji.
2. **Urnik zaposlenega.** Zaposleni ima en tedenski `Urnik` ali "ima urnik podjetja". Z lokacijami mora biti urnik po lokaciji, sicer isti človek hkrati dela v dveh mestih. Zasedenost (termini) je že vezana na osebo, ne na lokacijo, zato dvojna rezervacija iste osebe čez lokacije ostane preprečena. Dodati je treba: preverjanje prekrivanja urnikov iste osebe na isti dan med lokacijami in neobvezen čas poti med lokacijami.
3. **Dogodki in prazniki** (`events`) zdaj zaprejo cel dan za celo podjetje. Potrebna je lokacija ("zaprto samo v Mariboru"). Praznik je odvisen od države lokacije, ne podjetja.
4. **Opomniki in sporočila po terminu** (`Pošiljanje pred terminom` ~29× `Naslov podjetja`, `Pošiljanje po terminu`, prestavitev, potrdilo): sedaj vstavljajo naslov in telefon podjetja. Brez popravka stranka dobi opomnik z **naslovom napačne lokacije**. To je najvidnejša napaka za stranke, zato mora biti v isti fazi kot booking.
5. **Pravice.** Frontend bere prek uporabnikove seje (RLS), zapisuje pa prek n8n. Če pravic po lokacijah ne uveljavimo v RLS in v n8n, jih uporabnik z odprtimi orodji brskalnika obide. Pogledi v vmesniku niso zaščita. Preveriti: ali n8n pri zapisu sploh preverja vlogo uporabnika.
6. **Zaledje je n8n.** Lokacija mora skozi `Vpisovanje podatkov` (242 vozlišč) in `Booking v2` (211 vozlišč). V n8n JSON kopijah so trdo zapisani Supabase service ključi v HTTP vozliščih. Ker bomo vozlišča tako ali tako spreminjali, je to priložnost, da gredo v n8n poverilnice.
7. **Odprte veje.** Hkrati so odprte veje: povpraševanje, vprašalnik, cenik, redizajn (Apple), email predloga, receptionist-popravki, pozdrav. `Calendar.tsx` (2671 vrstic), `BookingSettingsModal`, booking store: veliko konfliktov. Z lokacijami začnemo šele, ko so te združene v main.
8. **Stari workflowi.** Poleg trenutnega Booking v2 (`XdrhufTyyypyYtey`) obstajata še stara `JEDROPLUS - Booking - Workflow` (120 vozlišč) in stara `Booking v2` (`vRy82…`, 56 vozlišč). Preveriti, ali sta neaktivna; če ne, jih izklopiti, da jih ni treba posodabljati.

## 5. Kdo kaj vidi

| Vloga | Lokacije | Opombe |
|---|---|---|
| Lastnik | vse | edini upravlja lokacije, paket, račune |
| Admin | vse ali samo dodeljene (vodja lokacije) | ne ustvarja lokacij |
| Zaposleni (staff) | lokacije, kjer dela (iz `Osebe_Lokacije` prek `person_id`) | obstoječe fine pravice (samo svoje termine ...) veljajo znotraj teh lokacij |

- Preklopnik lokacije v glavi (enako kot preklopnik podjetja), z "Vse lokacije" samo kjer je dovoljeno. Skrit pri 1 lokaciji. Izbira v localStorage in piškotku, da jo prebere tudi strežniško nalaganje.
- Obvestila o novi rezervaciji gredo članom te lokacije (+ lastnikom), ne vsem.
- Stranke: v1 vidijo vsi z dostopom do strank (stranka je last podjetja). Omejitev strank po lokaciji ni v obsegu, ker razbije zvestobo, portal in iskanje dvojnikov.
- Zgodovina (`zgodovina`) naj beleži lokacijo.

## 6. Spremembe po komponentah

### 6.1 Jedro+ (aplikacija)

- **Nastavitve → Lokacije** (nova stran): seznam, dodajanje, urejanje, arhiviranje, odpiralni čas, naslov/telefon, vidnost v bookingu. Zaklenjeno za ne-Pro z nadgradnjo.
- **Podjetje** (`nastavitve/podjetje`): naslov, telefon in urnik se preselijo na lokacijo; ostane naziv, davčna, logo, spletna stran.
- **Osebje** (`staff/page.tsx`, 850 vrstic): lokacije osebe + urnik po lokaciji (urejevalnik urnika se ponovno uporabi).
- **Storitve**: razpoložljivost po lokacijah. **Resursi** (`resursi/page.tsx`): polje lokacija.
- **Koledar** (`Calendar.tsx` + 17 komponent): filter lokacije; dnevni pogled kaže samo zaposlene, ki ta dan delajo na izbrani lokaciji; v pogledu "vse" oznaka lokacije na kartici; nov termin: izbira lokacije, nato filtrirani zaposleni/storitve/resursi; premik termina čez lokacije samo prek urejanja, ne z vlečenjem. Dogodki in odsotnosti dobijo polje lokacija.
- **Termini** (`AppointmentsClient`, izvoz): stolpec in filter lokacije.
- **Dashboard** (kartica Naslednji termin, števci) in **Analitika**: filter lokacije + primerjava lokacij za lastnika.
- **Rezervacije** (`BookingSettingsModal`, `RezervacijeClient`, `rezervacije/zahteve`): katere lokacije so spletno rezervabilne, zahteve po lokacijah.
- **Opomniki** (`ReminderSettingsModal`, `TemplateEditor`): oznaki `{{naslov}}` in `{{telefon}}` se razrešita iz lokacije termina; nova `{{ime_lokacije}}`. Pozor: `{{lokacija}}` je danes alias za naslov, zato ostane tako. `povezava_ocena` na lokacijo.
- **Člani** (`nastavitve/clani`, `team/invite`, `staff_role_permissions`): dodelitev lokacij članom.
- **Portal obvestila**: neobvezno ciljanje na lokacijo (lahko pozneje).
- **QR plakat**: QR na lokacijo (poleg splošnega).
- **Paketi** (`planAccess`, `lib/billing/plans.ts`, `addons/status`): `max_locations`, prikaz v primerjavi paketov, API za ustvarjanje lokacije preverja omejitev.
- **Onboarding in registracija** (`api/register`, `onboarding/create`, `firstRunSeed.ts`, workflow "Onboarding in dodelitev free stanja"): ob ustvarjenju podjetja se ustvari glavna lokacija.
- **Iskanje** (`SearchModal`), prevodi `messages/sl|en`, `types/*`.
- Čiščenje: `BookingDialog.tsx` ima zapuščeno `normalizeLocations` (bere `Lokacije` iz profila); zamenjati z resničnim modelom.
- Brez dela: Asistent+ in Chatbot+ (po odločitvi cenika se brišeta).

### 6.2 n8n

| Workflow | Sprememba |
|---|---|
| Booking v2 (init, slots, check-slots, create, request-*, confirm, reject) | `lokacijaId` v vseh akcijah; init vrne lokacije, osebe/storitve/resurse po lokaciji; urnik iz `Osebe_Lokacije`; filter dogodkov in resursov po lokaciji; zapis `lokacija_id`; obvestila članom lokacije; potrdilo z naslovom/telefonom lokacije |
| Vpisovanje podatkov (uporablja ga aplikacija) | `lokacija_id` v payloadu; potrdila in sporočila z naslovom lokacije (32 mest) |
| Pošiljanje pred terminom, Pošiljanje po terminu (obe različici), Prestavitev termina | naslov, telefon, povezava ocene iz lokacije termina |
| Portal: Get customer appointments, Get reschedule slots, Get free slots, Confirm reschedule, Cancel | vrnejo lokacijo; termine ponudijo samo za lokacijo termina; urnik po lokaciji |
| Receptionist+ SMS stranki, sms-send, email-send | oznake lokacije |
| Plačila: Sync subscription | nastavi `max_locations`, ob padcu paketa ali odpovedi dodatka sproži izbiro lokacij za arhiv |
| Dodatki: addon-purchase, addon-cancel | nov dodatek "dodatna lokacija" (`company_location_limits`, Stripe) |
| Onboarding | ustvari glavno lokacijo |
| Uvoz CRM | privzeto glavna lokacija (če uvaža termine) |
| Samodejni zaključek, Invoice, Dodatki | brez sprememb |

SQL: migracija, trigger za privzeto lokacijo, RLS funkcija `jp_user_locations(podjetje)`, pregled funkcij `jp_find_client`, `loyalty_*`, `increment_appointment_counter`, `zgodovina` sprožilcev.

### 6.3 booking-5

- `init` vrne `locations[]`; osebe, storitve in resursi nosijo `locationIds`.
- **Nov korak "Izberite lokacijo"** pred storitvami, prikazan samo pri 2+ spletno rezervabilnih lokacijah. Koraki so danes vezani na številke 1–7 v 6 dizajnih (`BookingStep`, `resolveStep`, `prevStep`), zato predlagam skupno komponento `LocationStep` in korak 0 v store-u (po vzoru skupnih `QuickSlotBar`/`request`), ne preštevilčenja v vsakem dizajnu.
- Povezave za neposredno lokacijo (`/{slug}/{dizajn}?lokacija=maribor`, QR, Instagram) preskočijo korak.
- `lokacijaId` v `fetchTimeSlotsRange`, `checkSlotAvailable`, `submit.ts` (create), `request.ts`. Strežnik pri manjkajočem `lokacijaId` vzame glavno lokacijo (starejši odjemalci delujejo).
- Naslov in telefon prihajata iz izbrane lokacije: `branding.server.ts` (zdaj bere iz `Podatki podjetij`), `calendar.ts` (.ics lokacija), `share.ts`, končna stran, `opengraph-image`, `CancellationPolicy` (ostane podjetje).
- Korak z zaposlenimi in "kdorkoli prost": samo osebe te lokacije.
- Praznični dizajn (`seasonal`): država iz lokacije.
- Stripe: pot ostane (podjetje), `success/cancel` URL ohrani lokacijo.
- Povpraševanje (`booking_mode='request'`): lokacija je del zahteve.

### 6.4 Portal strank

- Kartica termina kaže lokacijo (ime, naslov, zemljevid); `CompanyContact` pokaže seznam lokacij; `calendarInvite.ts` naslov lokacije termina; `api/company/[slug]` vrne `locations`.
- Prestavitev v v1 samo znotraj iste lokacije (druga lokacija = odpoved + nova rezervacija); odpoved ostane enaka.
- Gumb "Nova rezervacija" vodi na booking z lokacijo zadnjega obiska.
- Opomba: koda portala je v ločenem repozitoriju `jedroplus-portal` (veja `n8n-naslov`).

### 6.5 Receptionist+ (za drug pogovor)

1. **Usmerjanje klica** (Tim potrdil 1. 11.): privzeto **ena skupna številka**, številka na lokacijo je neobvezna izbira. `receptionist_phone_numbers` dobi neobvezen `lokacija_id`: z vrednostjo asistentka lokacijo pozna že ob pozdravu, brez (NULL) jo ugotovi med pogovorom. Vpraša šele, ko lokacija vpliva na odgovor (termini, odpiralni čas, naslov), in navede lokacije ("Ljubljana, Maribor ali Celje?"). Vprašanje preskoči, če lokacijo lahko sklepa: storitev ima samo ena lokacija, želena oseba dela samo na eni, ali je obstoječa stranka obiskala samo eno (iz terminov, nič novega se ne shranjuje). Splošna vprašanja (cenik) lokacije ne potrebujejo. Pri potrditvi vedno izgovori lokacijo. Prenos klica na človeka je po lokaciji, dokler ni znana, gre na privzeto številko podjetja.
2. **Nastavitve po lokaciji** (`receptionist_settings`): pozdrav/ime lokacije, `transfer_number` (recepcija druge lokacije je druga številka), `owner_alert_phone`, navodila (parking, posebnosti), odpiralni čas. Krediti ostanejo skupni.
3. `business_info.py`: odpiralni čas in naslov iz izbrane lokacije (zdaj `urnik` in `Naslov podjetja` iz `Podatki podjetij`); odgovor "ali ste odprti" po lokaciji.
4. `booking_client.py`: `lokacijaId` v `init`, `get_slots`, `check_slots`, `create_booking`. `_eligible_employee_ids` in `_resources` filtrirata po lokaciji (enaka past kot pri resursih zgoraj).
5. `tools.py`/`worker.py`: orodje za izbiro lokacije, razreševanje izgovorjenega imena prek `govorno_ime` + vzdevkov (sklanjatve, napačno prepoznan govor), ponovitev lokacije pri potrditvi termina (`_readback_time`), skupinska rezervacija (`group_booking.py`) po lokaciji.
6. `static_prompt.py`/`company_prompt.py`: blok lokacij in pravilo "nikoli ne mešaj lokacij".
7. Spremljevalno: `sms_client.py` (potrdilo z naslovom lokacije + portalna povezava), `owner_alert.py` in `call_summary.py` (kateri lokaciji pripada klic), `receptionist_calls.lokacija_id`, predpomnjen zvočni pozdrav (`greeting_audio.py`) po lokaciji, evali.
8. Prednost: najprej usmerjanje po številki in `lokacijaId` v rezervaciji (isto kot booking), nato pozdrav in navodila. Vse nepreizkušeno, dokler Tim ne opravi pravega klica (Telnyx čaka).

## 7. Odločitve (Tim potrdil vse predloge, 1. 11. 2026)

1. Paket: Pro do 3 lokacije, Plus/Free 1? (predlog: da)
2. Padec paketa: arhiviraj odvečne, ostane glavna? (predlog: da)
3. Ena številka ali več številk za Receptionist+ na podjetje? (odločeno: privzeto ena skupna z vprašanjem o lokaciji, številka na lokacijo neobvezna)
4. Cene storitev po lokacijah: v1 enake povsod? (predlog: da)
5. Prestavitev v portalu med lokacijami: v1 ne? (predlog: ne)
6. Zvestoba in popusti: skupni za podjetje? (predlog: da)
7. Čas poti med lokacijami za isto osebo: v1 ne ali neobvezno polje? (predlog: neobvezno, privzeto 0)

## 8. Redosled dela

0. **Priprava**: združiti odprte veje v main; preveriti RLS; preveriti, kateri workflowi so aktivni; odločitve iz razdelka 7.
1. **Baza**: tabele, stolpci, backfill glavne lokacije, trigger za privzeto lokacijo, RLS, `max_locations`, `company_location_limits`. Brez vidne spremembe.
2. **Jedro+ upravljanje**: Nastavitve → Lokacije, osebje po lokacijah, storitve, resursi, dogodki, člani/pravice, preklopnik.
3. **Koledar, termini, dashboard, analitika.**
4. **n8n**: Booking v2, Vpisovanje, opomniki, prestavitev (opomniki skupaj z bookingom, da ni napačnih naslovov).
5. **booking-5**: LocationStep, povezave, naslovi.
6. **Portal.**
7. **Receptionist+** (drug pogovor).
8. **Paketi in nadgradnja/padec, QR, glajenje.**

Test (obvezno po vsaki fazi): podjetje z 1 lokacijo nespremenjeno; podjetje z 2 lokacijama; oseba na dveh lokacijah isti dan; isti resurs-tip na obeh lokacijah; opomnik z naslovom prave lokacije; prestavitev in odpoved v portalu; klic na Receptionist+.

Obseg: zelo velik. Podatkovna plast in n8n workflowa Booking v2 + Vpisovanje sta jedro tveganja; koledar je obsežen, a mehanski.
