# Asistent+ — faza 4: plavajoči asistent na vseh straneh

13. 11. 2026.

## Kaj je narejeno

- **Plavajoči krogec spodaj desno** na vseh straneh za prijavljene.
  - Pokaže se samo, če ima podjetje vklopljen Asistent+ in ima uporabnik pravico (`/api/glas/stanje`).
  - Ni ga na prijavi, registraciji, uvajanju in testni strani.
  - Tap začne pogovor: asistent posluša, odgovori z glasom in posluša naprej.
  - Tap med govorom ga prekine. Tap med poslušanjem konča pogovor.
  - Med pogovorom se vrti barvni sij (podobno kot Siri).
- **Mehurček nad krogcem:**
  - slišano besedilo, odgovori in napake;
  - možnosti za izbiro (npr. dve istoimenski stranki);
  - predlog s Potrdi/Prekliči (zapiski);
  - polje za pisanje ukaza.
  - Na telefonu je čez celo širino nad krogcem, na računalniku je širok 380 px.
- **Pogovor ostane odprt med stranmi.** Asistent je v skupni postavitvi (`app/[locale]/layout.tsx`), ne v posamezni strani.
- **Samodejni premik:** ko asistent odpre obrazec ali stran (`pojdi`), se premakne sam, brez povezave »Odpri obrazec«.
  - Če je ta stran že odprta (npr. koledar), dobi namen kot dogodek, ker se ne naloži znova.
  - Koledar in stranke poslušata dogodek `asistent-pojdi`.
- **Glasovni »shrani« / »prekliči« v obrazcu**, ki ga je odprl asistent:
  - Ko je obrazec odprt, se krogec skrči v **pilulo na vrhu zaslona**. Dno lista z gumbom Shrani ostane prosto.
  - Asistent takrat posluša 30 s namesto 8 s, da je čas za pregled.
  - »Shrani«, »ja«, »potrdi«, »spremi«, »save«, »speichern«, »salva« sprožijo `requestSubmit()` obrazca. To je ista pot kot gumb Shrani: preverjanje polj, potrdilo stranki, resursi, n8n, vprašanje o obvestilu ob prestavitvi.
  - »Prekliči«, »ne«, »zapri«, »odustani«, »cancel« zaprejo obrazec brez shranjevanja.
  - Daljši stavek (»ja, ampak ob desetih«) ni ukaz obrazcu, ampak gre asistentu kot nov ukaz.
  - Ročno odprti obrazci se na glas ne odzivajo.
  - Če se obrazec po »shrani« zapre, mehurček pokaže »Shranjeno.«. Če preverjanje polj ne uspe, obrazec ostane odprt z napako.
- **Besedila gumba** so v vseh petih jezikih (`messages/*/layout.json` → `asistent`).

## Pravila, ki ostajajo

- Asistent ne shrani ničesar sam. Glasovni »shrani« je enakovreden pritisku gumba v obrazcu, ki ga uporabnik vidi.
- Podatki za obrazec gredo prek `sessionStorage`, ne prek URL-ja.
- Prepisi se ne zapisujejo v konzolo.

## Spremenjene datoteke

- Novo:
  - `components/glas/AsistentPlus.tsx`;
  - `components/glas/useGlasovniObrazec.ts`;
  - `lib/glas/odjemalec/obrazecGlas.ts`;
  - `tests/glas/faza4.test.ts`.
- `lib/glas/odjemalec/pogovor.ts`: neobvezen `lokalno` (izjavo obdela vmesnik brez strežnika) in nastavljiv `tisinaPoOdgovoru`.
- `AppointmentModal`, `AbsenceModal`, `ClientModal`: `ref` na obrazec in hook `useGlasovniObrazec`. Aktiven je samo, ko je obrazec odprt s predizpolnitvijo.
- `Calendar.tsx`, `ClientsClient.tsx`: branje namena prestavljeno v funkcije in dodan poslušalec dogodka. Obnašanje ob prihodu s povezavo je enako kot prej.

## Preizkušeno

- 158 testov (vitest), od tega 20 novih: prepoznava »shrani« in »prekliči« v petih jezikih ter stavki, ki niso ukaz obrazcu.
- `tsc` je čist. `eslint` nima novih opozoril v spremenjenih datotekah (število je enako kot prej).
- Prijavna stran se naloži brez gumba.

## Nepreizkušeno

- Celoten tok s prijavo v brskalniku:
  - krogec, mehurček in pilula;
  - premik na koledar z odprtim obrazcem;
  - »shrani« z glasom;
  - pogovor, ki ostane odprt čez strani.
- iPhone (Safari in aplikacija z začetnega zaslona): mikrofon po premiku strani, varni robovi.
- Obvestila (toast) spodaj desno se lahko za nekaj sekund prekrijejo s krogcem.

## Še odprto

- Hitrejši začetek pogovora: sejo in ključe bi lahko pripravili vnaprej, ko se krogec pokaže.
- Vprašanje »Obvestim stranko?« po prestavitvi je še vedno gumb, ne glas.
- Lasten SMS (n8n webhook) čaka tvojo odobritev.
