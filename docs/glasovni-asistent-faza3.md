# Asistent+ — faza 3: dejanja prek obstoječih obrazcev

13. 11. 2026. Timova odločitev: asistent razume ukaz in odpre **obstoječi obrazec že izpolnjen**. Uporabnik pregleda in pritisne Shrani.

Shrani ista koda kot pri ročnem vnosu:
- n8n;
- potrdilo SMS ali e-pošta;
- resursi;
- vprašanje o obvestilu ob prestavitvi;
- čakanje na zapis.

Strežnik asistenta pri teh dejanjih **ničesar ne zapiše**, zato ni podvojene poslovne logike.

## Kaj je narejeno

| Ukaz (primer) | Orodje | Kaj se odpre |
|---|---|---|
| »Vpiši Ano Novak jutri ob desetih na barvanje pri Tini« | `pripravi_termin` | Koledar → nov termin s stranko, storitvijo, zaposleno, dnevom in uro |
| »Prestavi Ano na petek ob enajstih« | `prestavi_termin` | Koledar → urejanje termina z novim časom. Ob shranjevanju aplikacija sama ponudi obvestilo stranki (obstoječe »obvestilo ob prestavitvi«). |
| »Ana ni prišla«, »zaključi Ano«, »odpovej Anin termin« | `status_termina` | Koledar → termin odprt, uporabnik tapne gumb |
| »Jutri od dveh do štirih me ni«, »Urška je bolna do petka« | `vpisi_odsotnost` | Koledar → obrazec za odsotnost, izpolnjen |
| »Dodaj novo stranko Bojan Horvat, 041 123 456« | `nova_stranka` | Stranke → obrazec za novo stranko, izpolnjen |

Preverjanja pred odprtjem obrazca:
- Pravice:
  - ustvarjanje terminov;
  - urejanje terminov;
  - ustvarjanje strank;
  - »samo svoji termini«, kar velja tudi za odsotnost (samo zase).
- **Ali je čas prost:** delovni čas, drugi termini in odsotnosti. Če ni, asistent opozori (»Tina ima takrat že termin«), a obrazec vseeno odpre. Resurse preveri obrazec sam.
- Več strank z istim imenom ali več terminov iste stranke: asistent najprej vpraša, katero ali katerega.
- Brez termina za nazaj. Pri novi stranki opozori na dvojnico.
- Česar uporabnik ni povedal (dan, ura, storitev), izbere v obrazcu sam. Asistent to pove.

### Zasebnost
- Podatki za obrazec (ID-ji, ime, telefon, razlog odsotnosti) gredo prek `sessionStorage` brskalnika, ne prek URL-ja.
  - URL nosi samo `?glas=1`, zato se v dnevnike strežnika (Vercel) in v zgodovino brskalnika ne zapiše nič osebnega.
  - Predizpolnitev je enkratna in velja 2 minuti.
- Izjema je `status_termina`: odpre obstoječo povezavo koledarja `?termin=ID&datum=…` (enako kot obvestila). ID termina ni oseben podatek.

### Spremenjene datoteke (obstoječe funkcije ostanejo enake)
- `components/appointments/AppointmentModal.tsx`: neobvezen `predizpolnitev` (stranka, storitev; pri urejanju nov datum in ura, trajanje ostane).
- `components/calendar/AbsenceModal.tsx`, `components/clients/ClientModal.tsx`: neobvezen `predizpolnitev`.
- `components/Calendar.tsx`, `app/[locale]/clients/ClientsClient.tsx`: preberejo `?glas=1` in obrazec.
- Testna stran: povezava »Odpri obrazec«.

## Sporočila strankam

- **Obvestilo ob prestavitvi:** pokrito. Obrazec za prestavitev po shranjevanju sam vpraša, ali obvestiti stranko (obstoječa pot `PRESTAVITEV_TERMINA_OBVESTILO`).
- **Lasten kratek SMS** (»Ani pošlji, da zamujam 10 minut«): **še ni narejen.**
  - `sms-send (Jedro+)` v n8n je samo podproces (Execute Workflow), brez spletnega naslova.
  - Edina pot za lastno besedilo v aplikaciji je Komunikacija. Ta je marketinška: filtrira privolitve in doda odjavo, zato ni primerna.
  - Potreben je nov n8n webhook, na primer `glas-sms`:
    - vhod: `company_id`, `client_id`, `besedilo`, `actor`;
    - telefon prebere sam iz `Stranke` (ne iz zahteve);
    - pokliče `sms-send` s kvoto in sender ID;
    - zapiše v `sms_log`.
  - Ko webhook obstaja, aplikacija doda orodje s potrditvenim žetonom: enkratni, potečejo po 2 min, idempotentni, kot pri zapiskih. To je sprememba v n8n in čaka tvoj »ja«.

## Preizkušeno

- 129 testov (vitest), od tega 22 novih v `tests/glas/faza3.test.ts`:
  - pravice in »samo svoji«;
  - zaseden čas, odsotnost, ure z besedami;
  - vprašanje ob več terminih, dvojnica;
  - pot z dvema parametroma;
  - enkratna predizpolnitev.
- `tsc` je čist. `eslint` ne da novih opozoril v spremenjenih vrsticah.
- Strani `/sl/koledar`, `/sl/clients` in `/sl/glas-test` se prevedejo (200).

## Nepreizkušeno

- Celoten tok v brskalniku s prijavo:
  - ali se obrazec res izpolni (stranka, storitev, konec termina po storitvi);
  - ali prestavitev ohrani trajanje;
  - ali se po shranjevanju pojavi vprašanje o obvestilu.
- Zaposleni z zaklenjenim zaposlenim (staff) pri novem terminu.
- Na testni strani je to povezava »Odpri obrazec«.
  - Govorni »ja« za Shrani pride s plavajočo bunko v fazi 4, ki ostane odprta čez strani.

## Luknje na ukaz

Ni v tej fazi. Ponudba prostih terminov strankam je odvisna od `docs/prosti-termini-nacrt.md`, kjer čaka 8 odločitev.

Asistent zna prebrati luknje (»kdaj imam prosto«, faza 2) in vpisati termin vanje (zgoraj).
