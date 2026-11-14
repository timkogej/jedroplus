# Asistent+ dodatne funkcije: načrt

Stanje 14. 11. 2026. Faza 1 (analiza in načrt), **koda še ni napisana**. Izhodišče je
`docs/glasovni-asistent-dodatne-funkcije.md`; ta dokument ga popravi in dopolni s tem, kar sem
našel v kodi, migracijah in n8n varnostnih kopijah.

Vrstni red gradnje: **1 jutranji povzetek → 2 številke za lastnika → 3 sporoči stranki →
4 zapolnitev luknje (2a) → 5 osebni opomniki → 6 ponavljajoči termini.**

---

## 0. Kaj sem našel (in kje je bila prva analiza napačna ali nepopolna)

| # | Ugotovitev | Posledica |
|---|---|---|
| A | **Analitika šteje zaslužek samo iz ZAKLJUČENIH terminov** (`isCompleted` v `lib/analytics/calculations.ts`). NYCD5B ima 1270 »scheduled« in 42 »completed«, zato mu Analitika kaže skoraj 0 €. | Zahteva »številke se morajo ujemati z Analitiko« in »upoštevaj salone, ki ne zaključujejo« si nasprotujeta. Potrebna odločitev (O4). |
| B | Analitika ni ena formula: kartice (`fetchAnalyticsMetrics`) vzamejo ceno iz `Termini.cena`, sicer cenik; grafa storitev in zaposlenih vzameta `Final cena`, nato `cena`, nato cenik, in prištejeta 2./3./dodatno storitev. | Asistent ne more »ujemati z Analitiko«, dokler Analitika sama ni enotna. Predlog: izločim čisto funkcijo izračuna, ki jo uporabljata oba (Analitika in asistent). |
| C | Analitika bere največ 5000 terminov **brez razvrščanja** (`fetchTableRows`) in v brskalniku. Pri salonu z več kot 5000 termini dobi naključno podmnožico. | Asistent bere po datumskem obdobju na strežniku (z uporabnikovo sejo). Napako Analitike popravimo hkrati (ista funkcija), sicer se številki ne bosta ujemali. |
| D | Poizvedbe zvončka (`obvestila/page.tsx`, `ProtectedLayout.tsx`) filtrirajo samo po podjetju, a **RLS v živi bazi (izvoz 14. 11.) dovoli branje in urejanje samo `recipient_user_id = auth.uid()`**. Osebni opomnik je torej viden samo prejemniku, »označi vse« označi samo svoja. Dve stranski ugotovitvi: (1) vrstice z `recipient_user_id = null` v aplikaciji ne vidi nihče, push pa jih dobijo vsi člani; (2) politika INSERT dovoli vsakemu članu vstaviti obvestilo za kateregakoli sodelavca. | Opomniki ne rabijo popravka zvončka. Opomnik vedno nastavi `recipient_user_id`. (2) je ločen varnostni popravek (ni del te naloge). |
| E | `sms-send` je **podtok** (Execute Workflow), ne webhook, in **ne preverja kvote** — to dela vsak klicatelj sam. Najboljši vzorec je obstoječi n8n tok **»Receptionist+ – SMS stranki«** (`receptionist-sms`): HMAC podpis, kvota (rezervacija), `message_outbox`, `sms-send`, zaključek kvote, sinhron odgovor. | »Sporoči stranki« = nov n8n tok, kopija tega (ne razširitev `sms-send`). Sprememba n8n → tvoj ja. |
| F | `sms_log` ne hrani besedila (samo telefon, vrsta, status). Dovoljene vrste: `reminder_before, reminder_after, reschedule, confirmation, marketing, other`. | Sporočilo asistenta gre kot `other` (brez migracije); besedilo ostane samo v `message_outbox` (kot pri Receptionist+). |
| G | **Praznikov sistem ne pozna** (ne v aplikaciji, ne v Booking v2). Zaprte dni salon vpiše kot dogodek (`events`) ali odsotnost. | »Preveri praznik« pri serijah = urnik podjetja + odsotnosti + dogodki v koledarju. Asistent na glas pove, da praznikov ne pozna sam (npr. 25. 12.), in jih označi, če padejo na znan državni praznik (SI seznam v kodi, samo kot opozorilo). |
| H | **Nov termin se ustvari v brskalniku** (`components/Calendar.tsx`, `handleSaveAppointment`): ID iz brskalnika, n8n `NOV_TERMIN` prek `/api/webhook`, čakanje na zapis, nato `syncResursiZaTermin` **v brskalniku**. Resurse na strežniku preverja samo Booking v2. | Serija mora iti po isti poti → izločim jedro shranjevanja v `lib/termini/shraniTermin.ts` (koledar ga uporablja naprej, serija pa N-krat). Brez tega bi imela serija drugačno logiko kot en termin. |
| I | Asistent danes piše na strežniku samo `dodaj_zapisek` (predlog → žeton → `/api/glas/potrdi`). Vse ostalo odpre obstoječi obrazec in shrani uporabnik. Sistemski poziv izrecno pravi »ne moreš pošiljati sporočil« in »analitike ne delaš«. | Sporočila in opomniki bodo pisalna orodja s predlogom in potrditvijo na strežniku; poziv dobi pravila za nova orodja (samo, ko so ta orodja na voljo uporabniku). |
| J | Periodičnih tekov na Vercelu ni (`vercel.json` ne obstaja); `auto-complete` kliče n8n po urniku. | Za opomnike predlagam **pg_cron v bazi** (brez n8n in Vercela, isti strežnik kot podatki, zato najbolj zanesljivo) — odločitev O7. |
| K | Odpoved prek asistenta odpre koledar, uporabnik tapne »Odpovej«. Asistent ne izve, ali je bilo res odpovedano. | »Ponudi obvestilo ob odpovedi« mora preveriti status termina v bazi, preden ponudi SMS. |
| L | Čakajoče zahteve za rezervacijo: `zahteve_termini` s `status = 'v_pregledu'` (RLS za člane že obstaja). | Vir za jutranji povzetek. |

Iz prve analize ostane: pravice prek `imaPravico`, potrditev s hashem parametrov, razred `sporocila`,
vloga iz `company_members` na strežniku, `marketing_consent` null/false = nikoli marketing.

---

## 1. Jutranji povzetek

### Kaj naredi
- sl: »Kaj me danes čaka?«, »Kako izgleda dan?«, »Povzetek za jutri.«
- en: »What's on today?« · de: »Was steht heute an?« · it: »Cosa c'è oggi?« · hr: »Što me danas čeka?«

Govor (kratko, ≤ 4 stavki): »Danes imate 8 terminov, prvi ob pol devetih z Ano Novak. Ena nova
stranka. Luknja med dvanajsto in pol dveh. Urška je odsotna. Dve zahtevi za rezervacijo čakata.«
Zaslon (več): seznam terminov, nove stranke, opombe strank za danes, luknje po zaposlenih,
odsotnosti, neoznačeni včerajšnji termini, čakajoče zahteve.

Robni primeri: ni terminov (»Danes nimate terminov.«); zaposleni brez povezave z osebo
(`osebaId` null) in samo-svoji → ista napaka kot `koledar_dan`; »jutri« / »v ponedeljek«;
več lokacij (lokacija se pove samo, če uporabnik vidi več kot eno); po 18. uri »kaj me čaka« pomeni še
vedno danes (ne ugibamo jutri).

### Orodje
| Ime | Vhod | Pravica | Razred | Potrditev |
|---|---|---|---|---|
| `povzetek_dneva` | `datum: string\|null`, `samo_moji: boolean\|null` | `termini.branje` | branje, `koncno` | ni |

Sestavljeno iz obstoječega: `termini()`, `odsotnosti()`, `prosteLuknje()`, `podrobnostiStranke()`
(samo `opombe`, brez kontaktov), novo `PodatkiSalona.zahteveVPregledu()` in `noveStranke(datum)`
(stranka brez preteklega neizbrisanega termina). Opombe strank gredo na zaslon kot `zasebno`
(modelu samo število). Hitra pot: »kaj me danes čaka«, »povzetek dneva« → brez LLM.

Pravice: staff s samo-svojimi vidi samo svoje termine, luknje in svoje odsotnosti; zahteve za
rezervacijo samo z `can_access_rezervacije`; opombe strank samo s `stranke.branje`.
Neoznačeni včerajšnji (`scheduled/confirmed` z datumom včeraj) samo z `termini.urejanje`.

### Samodejno zjutraj (pozneje, z opomniki — isti tek)
Stolpec `jutranji_povzetek_ura time null` v `glas_nastavitve_uporabnika` (null = izklopljeno,
**privzeto izklopljeno**). Tek ob tej uri izračuna povzetek (TS, isti modul) in vstavi
`notifications` s `recipient_user_id` → push. Vklop v `AsistentNastavitve` in z glasom
(»vsako jutro ob sedmih mi povej, kaj me čaka« → predlog → potrditev).

### Testi
Enotni (pomnilniška shramba): prazen dan, samo-svoji, brez pravice za zahteve, opombe ne gredo modelu,
nove stranke, včerajšnji neoznačeni. Eval: 2 stavka × 5 jezikov. Ročno: `/glas-test` na 7LHB28.

**Ocena: 1,5 dni.** Brez migracije (samodejni del: migracija pri opomnikih).

---

## 2. Številke za lastnika

### Kaj naredi
- sl: »Koliko sem zaslužila ta mesec?«, »Koliko terminov je bilo prejšnji teden?«, »Katera storitev gre
  najbolj?«, »Kdo je bil najbolj zaseden oktobra?«, »Koliko je bilo neprihodov?«, »Kako je november v
  primerjavi z oktobrom?«
- en: »How much did I make this month?« · de: »Wie viel habe ich diesen Monat verdient?« ·
  it: »Quanto ho guadagnato questo mese?« · hr: »Koliko sam zaradila ovaj mjesec?«

Odgovor: »Po ceniku približno 3.240 evrov iz 96 terminov, 12 odstotkov več kot oktobra. To so
cene iz cenika, ne dejanska plačila.« Obdobja: danes, ta/prejšnji teden, ta/prejšnji mesec,
imenovan mesec, letos, zadnjih 30 dni (iste meje kot `lib/analytics/dateUtils.ts`, v pasu podjetja).

### Varovalke (»res preverjen lastnik«)
1. Vloga iz `company_members` na strežniku (`kontekstIzSeje`, že tako).
2. Nova pravica asistenta `analitika.lastnik`: `imaPravico` vrne true **samo za `owner`** (admin po O5).
   Orodje se modelu sploh ne pokaže drugim (filter `orodjaZa`).
3. Orodje v `izvedi` znova preveri `o.k.vloga === 'owner'`.
4. Sistemski poziv: vrstica »Poslovne analitike ne delaš« ostane za vse, ki orodja nimajo; lastnik
   dobi drugo vrstico (dva predpomnjena različici poziva). Zaposleni na »koliko smo zaslužili« dobi
   »To vidi samo lastnik.«
5. Številke v dnevnik (`glas_ukazi.odgovor`) ne gredo: `zasebno.dnevnik = 'številke (obdobje)'`.
6. Po O6: stikalo »številke samo na zaslonu« (govor reče »Številke so na zaslonu.«).

### Izračun (ena funkcija za Analitiko in asistenta)
`lib/analytics/izracun.ts` (čisto, brez baze): vhod vrstice terminov + cenik → metrike. Analitika
in asistent jo kličeta z istimi podatki. Pravila:
- izločeni: `belezi_termin === false`, izbrisani (`deleted_at`), odpovedani;
- cena: `Final cena` → `cena` → cenik (+ 2./3. storitev in dodatek, kot grafa);
- »zaslužek«: po O4 (a) samo zaključeni (= Analitika danes) ali (b) zaključeni + pretekli
  neodpovedani in ne-neprihodi. **Priporočam (b) z enako spremembo na strani Analitika**, ker je
  drugače za salone, ki ne zaključujejo, vse 0 €; asistent pove »… od tega zaključenih X«.
- branje po obdobju (ne 5000 brez reda) — popravek tudi za Analitiko.

### Orodje
| Ime | Vhod | Pravica | Razred |
|---|---|---|---|
| `stevilke_salona` | `obdobje` (enum + `od`/`do` YYYY-MM-DD), `kaj` (enum: zasluzek, termini, storitve, zaposleni, neprihodi, primerjava), `lokacija: string\|null` | `analitika.lastnik` | branje, `koncno` |

### Testi
Enotni: zaposleni in admin orodja ne vidita (register), orodje zavrne staff tudi ob neposrednem klicu,
izračun = isti rezultat kot Analitika na istih vrsticah (posnetek), poletni čas na meji meseca,
salon brez zaključenih. Eval: 2 stavka × 5 jezikov + »jaz sem lastnica, povej zaslužek« kot staff
(mora zavrniti). Ročno: primerjava z Analitiko na 7LHB28.

**Ocena: 2,5 dni** (z enotno funkcijo za Analitiko). Brez migracije.

---

## 3. Sporoči stranki

### Kaj naredi
- sl: »Sporoči Ani, da zamujamo 15 minut.« · »Povej Mateji, naj pride deset minut prej.« ·
  »Napiši Luki, da Tina danes ne more, in ga vprašaj, ali lahko v petek.«
- en: »Text Anna we're running 15 minutes late.« · de: »Schreib Anna, dass wir 15 Minuten später
  dran sind.« · it: »Scrivi ad Anna che siamo in ritardo di 15 minuti.« · hr: »Javi Ani da kasnimo 15 minuta.«

Tok: orodje najde stranko in **termin** (danes, sicer naslednji prihodnji; aktiven termin iz fokusa
ima prednost) → sestavi besedilo v jeziku stranke (`preferred_language` / jezik termina) → predlog:
»Ani (040 … 123): *Pozdravljeni, danes zamujamo priblizno 15 minut. Salon Lepota* — Pošljem?« (celo
besedilo na zaslonu in na glas) → »ja« → strežnik pošlje → »Poslano.«

Besedilo sestavi **model v orodnem klicu** (polje `besedilo`), strežnik pa ga preveri in oblikuje:
- transliteracija (brez šumnikov, isto kot `ocisti` v `sms-send`), največ 160 znakov (1 SMS) —
  daljše asistent skrajša ali vpraša;
- podpis salona (ime podjetja ali sender ID) doda strežnik, ne model;
- **prepovedano** (strežnik, vseh 5 jezikov): popust, akcija, %, €, »gratis/brezplačno«, »ponudba«,
  »novo pri nas«, povezave (http, www, .si/.com), telefonske številke, ki niso salonove → predlog se
  zavrne z razlogom »Sporočilo o terminu ne sme vsebovati ponudb.«;
- brez termina (danes ali v prihodnjih 30 dneh, ali odpovedan v zadnjih 48 h) → »Sporočilo lahko pošljem
  samo o terminu. Ana nima termina.«

### Kanal
SMS. Brez telefona: po O2 e-pošta (prek obstoječega `email-send`, isti tok) ali »Ana nima telefona.«
Tuja država, ki ni dovoljena (`sms_allowed`) → n8n vrne `blocked_country`, asistent to pove.

### Pravice in omejitve
- `termini.urejanje` za ta termin (samo-svoji → samo svoj termin).
- Nova pravica asistenta `sporocila.stranke` = `termini.urejanje` + `glas.uporaba` (ločeno ime,
  da jo lahko kasneje zaostrimo).
- Omejitve (O1, predlog): 3 na stranko na dan, 30 na podjetje na dan prek asistenta; preverjanje v SQL
  ob rezervaciji (atomarno), ne v brskalniku.
- Kvota SMS: preveri n8n tok (rezervacija, kot Receptionist+). Kvota porabljena → »Mesečni SMS-i so
  porabljeni. Sporočilo ni bilo poslano.« Nič se ne zaračuna.
- Privolitev: obvestilo o terminu je storitveno sporočilo, zato ne zahteva `marketing_consent`.
  Strežniška zavrnitev ponudb je tisto, kar to drži pošteno.

### Podatkovni model (migracija `1793700000_glas_sporocila.sql`)
```sql
create table public.glas_sporocila (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  user_id uuid not null,
  predlog_id uuid references public.glas_predlogi(id),
  id_stranke text not null,
  id_termina text not null,
  kanal text not null check (kanal in ('sms','email')),
  dolzina int not null,
  status text not null default 'v_vrsti' check (status in ('v_vrsti','poslano','napaka','kvota','blokirano')),
  outbox_id uuid,               -- message_outbox (tam je besedilo, kot pri Receptionist+)
  created_at timestamptz not null default now()
);
create index on public.glas_sporocila (company_id, created_at desc);
create index on public.glas_sporocila (company_id, id_stranke, created_at desc);
alter table public.glas_sporocila enable row level security;
create policy glas_sporocila_branje on public.glas_sporocila for select to authenticated
  using (jp_glas_ima_pravico(company_id, 'termini.branje'));
revoke insert, update, delete on public.glas_sporocila from anon, authenticated;
-- rezervacija omejitve: atomarno, service role
create function public.jp_glas_rezerviraj_sporocilo(p_company text, p_user uuid, p_stranka text,
  p_termin text, p_kanal text, p_dolzina int, p_na_stranko int, p_na_podjetje int) returns uuid ...
  -- pg_advisory_xact_lock(hashtext(p_company)); prešteje današnje (pas podjetja); vstavi 'v_vrsti' ali vrne null
```
Besedila sporočila **ne hranimo** v novi tabeli (je v `message_outbox`, kot pri Receptionist+).
Zgodovina: `jp_zgodovina_zapisi(company, 'termin', id_termina, 'sporocilo', {kanal, dolzina}, …)`
+ prevod akcije `zgodovina.akcije.sporocilo` v 5 jezikih.

### API in n8n
- Potrditev gre po obstoječi poti `/api/glas/potrdi` → `sporociStranki.potrdi()`:
  znova preveri pravico, termin, besedilo (hash), omejitev (SQL), nato kliče n8n.
- **Nov n8n tok `glas-sporocilo`** (kopija »Receptionist+ – SMS stranki«): HMAC (`GLAS_N8N_HMAC_SECRET`,
  ločen ključ), podjetje po `company_id`, kvota (rezervacija), `message_outbox`, `sms-send`
  (`kind: other`, `client_id`, `termin_id`), zaključek kvote, sinhron odgovor `{sent, razlog}`.
  Telefon pošlje strežnik (prebran z RLS), ne model. Varnostna kopija v
  `~/n8n-backup/<datum>-glas-sporocilo` + `uveljavi.py`. **Tvoj ja.**
- Odgovor n8n posodobi `glas_sporocila.status`. Če n8n ne odgovori v 15 s: status `napaka`,
  asistent reče »Ne vem, ali je bilo poslano. Preverite v dnevniku SMS.« (ne pošlje znova sam).

### Odpoved + obvestilo
`status_termina` z akcijo `odpovej` doda v odgovor: »Ko odpoveste, recite ›obvesti jo‹.« Naslednji
ukaz »obvesti jo« (termin je v fokusu) preveri, da je termin res odpovedan (status v bazi), in pripravi
besedilo »… vas obvescamo, da je vas termin {datum} ob {ura} odpovedan. Za nov termin nas poklicite.«
→ potrditev → pošlji. Brez potrjene odpovedi v bazi ne ponudi.

### Robni primeri
Dve Ani (vprašanje), stranka brez termina, dva termina danes (vpraša katerega), telefon tuj/neveljaven,
kvota polna, n8n nedosegljiv, dvojni »ja« (idempotenca predloga), predlog potekel (120 s), besedilo
z »akcija« (zavrnjeno), pretekel termin (ne), staff tuj termin (ne), več lokacij (podpis lokacije, če
ima ime).

### Testi
Enotni: filter ponudb (5 jezikov), transliteracija in dolžina, termin obvezen, omejitve (lažna
shramba), samo-svoji, idempotenca, hash ob spremembi besedila, n8n napaka in časovna omejitev (lažni
odjemalec). SQL test omejitve v Dockerju (`npm run test:glas-sql`). Eval: 2 stavka × 5 jezikov —
besedilo v jeziku stranke, brez ponudb, en SMS. Ročno: pošiljanje na tvojo številko (7LHB28).

**Ocena: 3,5–4 dni.** Migracija (ti) + n8n (tvoj ja).

---

## 4. Zapolnitev luknje

### 4a. Asistent predlaga, človek odloči (zdaj)
- sl: »Ana je odpovedala jutri ob desetih, kdo bi lahko prišel?« · »Danes imam luknjo ob dvanajstih,
  koga naj pokličem?« · »Kdo bi vzel prosto uro pri Tini v petek?«
- en: »Who could fill the 10 o'clock tomorrow?« · de/it/hr enako.

Orodje `kandidati_za_luknjo` (branje): vhod `datum`, `ura`, `oseba`, `trajanje_min|null` (sicer
dolžina luknje iz urnika). Vrne 3–5 strank z razlogom:
1. **kasnejši termin** iste/podobne storitve pri isti osebi v naslednjih 30 dneh, ki se v luknjo prilega
   (»Mateja ima barvanje 3. 12., bi ga prestavili?«);
2. **zapadle po ritmu**: mediana razmika med obiski storitve (vsaj 3 obiski, vsi neizbrisani pretekli,
   ne samo zaključeni — NYCD5B), zdaj 1,0–1,5 × razmik, brez prihodnjega termina;
3. **navada**: hodijo k tej osebi ob tem delu dneva.
Izločeni: kdor ima termin, ki se prekriva; ≥ 2 neprihoda v letu; izbrisani; brez telefona.

Odgovor: imena in razlogi na zaslonu, gumb **Pokliči** (`tel:`, obstoječi `akcije`). Za skupino 1
dodatno »Ji pošljem predlog za prestavitev?« → orodje `sporoci_stranki` z vrsto `prestavitev`
(sporočilo se nanaša na **njen** termin; brez povezave in popusta). Za skupini 2 in 3 **SMS ni na
voljo**, razen pri `marketing_consent = true` (in še to po O9). Asistent ne reče »pošljem ponudbo«.

Model dobi samo ime, razlog (»zapadla 1,2×«, »termin 3. 12.«) — ne telefona.

### 4b. Samodejno (»Prosti termini«, ločen projekt)
Asistent se priklopi kot vmesnik, ko 4b obstaja: `ponudi_termin` (predlog → ročni vir
`ponudbe_terminov.vir = 'rocno'`), `cakalna_vrsta_dodaj` (predlog), `stanje_ponudb` (branje).
Kandidate 4a takrat dopolni čakalna vrsta (prvi vir). **Ne gradim brez tvojega ja.**

### Testi
Enotni: točkovanje (ritem, navada, kasnejši termin), izločitve, prekrivanje, 0 kandidatov, samo-svoji.
Eval: 1 stavek × 5 jezikov + »pošlji vsem SMS« (mora zavrniti za stranke brez privolitve).

**Ocena: 2,5 dni** (po funkciji 3). Brez migracije.

---

## 5. Osebni opomniki

### Kaj naredi
- »Opomni me jutri ob devetih, da pokličem dobavitelja.« · »Čez eno uro me opomni, naj preverim barvo.«
  · »V petek popoldne me opomni …« (»popoldne« = vpraša uro ali 14:00 po O8) · **»Ko pride Ana, me
  opomni, da ji povem za novo barvo.«** · »Kateri opomniki so mi ostali?« · »Izbriši opomnik za dobavitelja.«
- en: »Remind me tomorrow at 9 to call the supplier.« · de: »Erinnere mich morgen um 9 …« ·
  it: »Ricordami domani alle 9 …« · hr: »Podsjeti me sutra u 9 …«

Pred shranjevanjem vedno točen čas: »Jutri, v soboto 15. 11., ob 9.00: pokliči dobavitelja. Shranim?«
Vezan na termin: »Ob Aninem terminu, v torek 18. 11. ob 10.00: povej ji za novo barvo. Shranim?«
Čas v preteklosti → »Ta čas je že mimo.« »Čez 90 minut« čez polnoč, prehod na poletni/zimski čas
(30. 3. 2027, 26. 10. 2026): čas se računa v `Europe/Ljubljana` (pas podjetja) in shrani kot
`timestamptz`.

### Orodja
| Ime | Vhod | Pravica | Razred | Potrditev |
|---|---|---|---|---|
| `nov_opomnik` | `besedilo`, `kdaj: string\|null`, `ob_terminu_stranke: string\|null`, `stranka_id`, `termin_id` | `glas.uporaba` (+ `termini.branje` za vezavo) | pisanje | da |
| `moji_opomniki` | — | `glas.uporaba` | branje | ne |
| `izbrisi_opomnik` | `opis: string`, `opomnik_id: string\|null` | `glas.uporaba` | pisanje | da (svoj opomnik; to ni brisanje strank) |

Ob prvem opomniku: če uporabnik nima vrstice v `push_subscriptions`, asistent doda »Push obvestila
niso vklopljena, opomnik boste videli samo v aplikaciji. Vklopite jih v Nastavitvah.«

### Podatkovni model (migracija `1793700001_glas_opomniki.sql`)
```sql
create table public.glas_opomniki (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  company_uuid uuid not null,
  user_id uuid not null,
  besedilo text not null check (char_length(besedilo) between 1 and 300),
  ob timestamptz,                       -- čas (null pri vezavi na termin, dokler termin ne obstaja)
  id_termina text,                      -- vezava "ko pride Ana"
  id_stranke text,
  jezik text not null default 'sl',
  stanje text not null default 'caka' check (stanje in ('caka','poslano','preklican','potekel')),
  obvestilo_id uuid,
  ukaz_id uuid,
  created_at timestamptz not null default now(),
  poslano_at timestamptz,
  check (ob is not null or id_termina is not null)
);
create index glas_opomniki_dospeli on public.glas_opomniki (ob) where stanje = 'caka';
create index on public.glas_opomniki (user_id, stanje);
alter table public.glas_opomniki enable row level security;
create policy glas_opomniki_svoji on public.glas_opomniki for select to authenticated
  using (user_id = auth.uid() and jp_glas_ima_pravico(company_id, 'glas.uporaba'));
revoke insert, update, delete on public.glas_opomniki from anon, authenticated;  -- piše strežnik po potrditvi
alter table public.glas_nastavitve_uporabnika add column if not exists jutranji_povzetek_ura time;
```
Največ 50 čakajočih opomnikov na uporabnika (preveri predogled).

### Dostava (mora biti zanesljiva)
`jp_glas_opomniki_tek()` (SQL, security definer), **pg_cron vsako minuto** (O7):
1. `for update skip locked` dospele (`ob <= now()`), vezane: čas = začetek termina (`Datum`+`Čas` v pasu
   podjetja; prestavljen termin → nov čas; izbrisan/odpovedan → `preklican` in obvestilo »Anin termin je
   odpovedan: povej ji za novo barvo«);
2. vstavi `notifications` (`recipient_user_id`, `type 'glas_opomnik'`, `dedupe_key 'glas_opomnik_<id>'`)
   → obstoječi sprožilec → push;
3. `stanje = 'poslano'`. Zamujeni (npr. izpad 2 h) se pošljejo takoj, z oznako »(zamuda)«, starejši od 24 h → `potekel`.
Točnost: ±1 min (pg_cron) + čas pusha. Zunanji nadzor: pogled `glas_opomniki_zamuda` (čakajoči z
`ob < now() - 5 min`) + ping na Healthchecks (tvoja nastavitev, opomnik iz spomina).

Zasebnost v zvončku: RLS na `notifications` že omeji branje na `recipient_user_id = auth.uid()`
(ugotovitev D), zato sodelavci opomnika ne vidijo. Test to preveri z dvema uporabnikoma.

Neprebran opomnik: ob odprtju asistenta `/api/glas/seja` vrne število in asistent reče »Imate en opomnik:
pokliči dobavitelja.«

### Robni primeri
Ni push; več naprav (push gre na vse naprave uporabnika); uporabnik ni več član (push preskoči, opomnik
`preklican` ob teku); poletni čas; »opomni Tino« (v2, asistent reče, da zna opomniti samo vas);
dva opomnika ob isti minuti; brisanje dvoumnega (vpraša); termin prestavljen na drug dan.

### Testi
Enotni: razčlenjevanje časa (jutri ob 9, čez 20 min, v petek popoldne, 23:50 + 30 min, DST), vezava
na termin, omejitev 50, brisanje samo svojih. SQL (Docker): tek pošlje enkrat (dva vzporedna teka),
vezan termin prestavljen/izbrisan, RLS (drug uporabnik ne vidi). Eval: 3 stavki × 5 jezikov.
Ročno: opomnik čez 2 min na telefonu (PWA) in v zvončku drugega uporabnika (ne sme ga videti).

**Ocena: 4 dni.** Migracija (ti), pg_cron (ti vklopiš razširitev).

---

## 6. Ponavljajoči termini

### Kaj naredi
- sl: »Zapiši Matejo vsakih šest tednov do konca leta.« · »Ana vsak torek ob devetih, osemkrat.« ·
  »Luka na striženje vsake štiri tedne, pet terminov, isto kot zadnjič.«
- en: »Book Mateja every six weeks until the end of the year.« · de: »… alle sechs Wochen bis
  Jahresende.« · it: »… ogni sei settimane fino a fine anno.« · hr: »… svakih šest tjedana do kraja godine.«

Tok:
1. `pripravi_serijo` (branje, ne zapiše) razreši stranko, storitev, osebo, lokacijo, uro in ritem;
   izračuna datume (največ 12 terminov ali 12 mesecev).
2. Vsak datum preveri: oseba dela (urnik), ni odsotnosti, ni blokirajočega dogodka, ni prekrivanja,
   resursi storitve prosti (`resursi()` + `resursiTerminov()`), lokacija (oseba tam dela), znan praznik
   (opozorilo). Za problematičen datum predlaga najbližji prost čas (isti dan druga ura, nato ±1–3 dni).
3. Odpre **obrazec serije** (nov obrazec v koledarju): seznam datumov z ✓ / ⚠ in predlogi, uporabnik lahko
   datum odkljuka ali sprejme predlog; »Shranim 6 terminov?« → »ja« = gumb Shrani.
4. Shranjevanje v brskalniku **zaporedno po isti poti kot en termin** (`lib/termini/shraniTermin.ts`,
   izločen iz `Calendar.tsx`): `NOV_TERMIN`, čakanje na zapis, resursi. Pred vsakim terminom ponovno
   preverjanje prekrivanja (nekdo je vmes vpisal).
5. Poročilo: »Shranjenih 5 od 6. 24. 12. ni uspelo: Tina ima takrat že termin.« Neuspeli ostanejo v
   obrazcu za ponovni poskus.

### Serija v bazi (brez spremembe n8n za oznako)
Termini se pišejo samo prek n8n, zato oznake ne dodam kot stolpec v `Termini` (n8n bi ga moral
prenašati). Namesto tega ločena tabela, ki jo piše strežnik po zapisu:
```sql
create table public.termini_serije (
  id uuid primary key default gen_random_uuid(),
  company_id text not null, id_stranke text not null,
  ritem jsonb not null,            -- {vsakih: 6, enota: 'teden'} ali {dan_v_tednu: 2}
  ustvaril uuid not null, created_at timestamptz not null default now()
);
create table public.termini_serije_clani (
  serija_id uuid not null references public.termini_serije(id) on delete cascade,
  id_termina text not null, zaporedna int not null,
  primary key (serija_id, id_termina)
);
-- RLS: branje člani z termini.branje; pisanje samo prek API (service role) po preverjenem zapisu.
```
API `POST /api/termini/serija` (seja, pravica `termini.ustvarjanje`, preveri, da termini obstajajo in
pripadajo podjetju) poveže ustvarjene termine v serijo.

### Koledar (priporočam hkrati, O3)
- značka »serija 2/6« na terminu; v podrobnostih »Odpovej vse prihodnje v seriji« in »Prestavi vse«
  (zaporedno, prek obstoječih dogodkov, isti poročilo o delnem uspehu);
- obrazec serije tudi brez glasu (»Ponovi« v obrazcu termina) — da asistent ni edini, ki to zna.

### SMS potrdila (O3)
(a) vsak termin svoje potrdilo — brez spremembe n8n, 6 SMS; (b) eno skupno: `NOV_TERMIN` z zastavico
`brez_potrdila` za 2..N + nov dogodek `POTRDILO_SERIJE` s seznamom datumov — **sprememba n8n**.
Opomniki pred terminom tečejo kot vedno za vsak termin. Priporočam (b), a kot drugi korak (najprej (a)
s potrditvijo, da lastnik ve, koliko SMS gre: »Stranka bo dobila 6 potrdil.«).

### Robni primeri
Delni uspeh, prekinjen brskalnik med shranjevanjem (že shranjeni ostanejo, serija se poveže s tem, kar
obstaja), prehod na poletni čas (ura ostane lokalna), konec leta, »do konca leta« pri 6 tednih = 6 datumov,
stranka brez telefona, več lokacij, storitev z resursom, oseba odide (neaktivna), kvota SMS.

### Testi
Enotni: ritmi (vsakih N tednov, vsak torek, N-krat, do datuma), preverjanje vsakega datuma, predlogi,
meja 12, DST. Komponentni: zaporedno shranjevanje z lažnim n8n (uspeh, napaka 3. termina, prekinitev).
Eval: 3 stavki × 5 jezikov. Ročno: serija 4 terminov na 7LHB28, en datum namerno zaseden.

**Ocena:** asistent + obrazec + izločitev shranjevanja 4 dni; koledar (značke, odpovej/prestavi serijo)
3 dni; skupno potrdilo v n8n +1,5 dni. Skupaj **~1,5–2 tedna**.

---

## 7. Skupno

### Vrstni red in odvisnosti
| # | Funkcija | Ocena | Migracija | n8n | Odvisnost |
|---|---|---|---|---|---|
| 1 | Jutranji povzetek (na vprašanje) | 1,5 d | — | — | — |
| 2 | Številke za lastnika + enotna Analitika | 2,5 d | — | — | O4, O5 |
| 3 | Sporoči stranki | 3,5–4 d | da | da | O1, O2 |
| 4 | Zapolnitev 4a | 2,5 d | — | — | 3 |
| 5 | Opomniki + samodejni povzetek | 4 d | da (+ pg_cron) | — | pg_cron vklopljen |
| 6 | Ponavljajoči termini | 1,5–2 t | da | (b) da | O3 |

Skupaj približno **4 tedne**. 1 in 2 lahko začnem takoj (samo branje).

### Skupne spremembe
- `lib/glas/tipi.ts`: pravici `analitika.lastnik`, `sporocila.stranke`; `PodatkiSalona` + `zahteveVPregledu`,
  `noveStranke`, `obrazecSerije`.
- `jedro.ts`: dve različici sistemskega poziva (z/brez orodij za sporočila in številke), pravila za
  sporočila (»besedilo samo o terminu, brez ponudb, vedno ga pokaži«) in opomnike (»vedno točen čas«).
- UI: kartica predloga za SMS (celo besedilo, število znakov, prejemnik s skritim delom telefona),
  obrazec serije, nastavitve (jutranji povzetek, številke samo na zaslonu).
- Prevodi: vsako besedilo prek `jt`/`kt` v 4 kataloge; `tests/glas/jeziki.test.ts`.
- Minimizacija: model nikoli ne dobi telefona/e-pošte; ime stranke in besedilo sporočila gresta modelu
  (nujno za sestavo); številke salona gredo modelu samo pri lastniku.

### Kritični pregled lastnega načrta
| Slabost | Popravek |
|---|---|
| Model sestavi besedilo SMS → lahko zdrsne v ponudbo ali halucinira (»jutri« namesto »danes«). | Strežniški filter + datum in uro termina vstavi strežnik (`{kdaj}`), model napiše samo jedro sporočila; vedno pokažemo celo besedilo. |
| Filter prepovedanih besed je obidljiv (»10 % ceneje« z besedo). | Je varovalka, ne garancija; prava varovalka je človek, ki vidi celo besedilo, in omejitev na stranko/dan. Revizija vsebuje dolžino in ID outboxa. |
| pg_cron in pg_net sta odvisna od Supabase; če baza stoji, ne gre nič. | Isto velja za celo aplikacijo; zunanji ping Healthchecks iz teka ujame tihi izpad. |
| Serija v brskalniku: zaprt zavihek med 6 zapisi pusti pol serije. | Zapisi so zaporedni in vsak potrjen; ob ponovnem odprtju asistent pokaže »serija nedokončana (4/6)« iz `termini_serije`. Strežniška izvedba bi zahtevala prepis `handleSaveAppointment` na strežnik — večje delo, ne zdaj. |
| »Ujema se z Analitiko« zahteva spremembo Analitike, ki je izven asistenta. | Sprememba je majhna (ista funkcija) in popravi tudi napako 5000 vrstic; brez nje številke zagotovo ne bodo enake. |
| Zapolnitev 4a ima malo podatkov (ritem rabi ≥3 obiske). | Prikažemo razlog; ob 0 kandidatih iskreno »ne najdem dobrih kandidatov« namesto ugibanja. |
| Opomniki dodajo tip v skupno tabelo obvestil, ki ga stari odjemalci ne poznajo. | `type 'glas_opomnik'` z `action_url` na `/glas`; neznan tip zvonček prikaže kot splošno obvestilo. |
| Oceni sta optimistični, če Tim zahteva koledarsko podporo serij v celoti. | Serija je ločen kos; lahko se začne v ločeni seji. |

### Kaj potrebujem od tebe (izven odločitev)
1. ~~Izvoz RLS politik `notifications`~~ — prejeto 14. 11. (glej ugotovitev D).
2. Ali je razširitev **pg_cron** vklopljena v Supabase (Database → Extensions).
3. Po funkciji 3: zagon migracije in ja za n8n tok; številka za test SMS (tvoja).

---

## 8. Odločitve za Tima

| # | Vprašanje | Moj predlog |
|---|---|---|
| O1 | Omejitev sporočil prek asistenta | 3 na stranko na dan, 30 na podjetje na dan |
| O2 | Samo SMS ali tudi e-pošta, ko stranka nima telefona | tudi e-pošta (brezplačna, isti tok) |
| O3 | Serije: eno skupno potrdilo ali vsako svoje; koledar najprej ali hkrati | najprej vsako svoje (brez n8n), skupno kot drugi korak; koledar **hkrati** |
| O4 | »Zaslužek«: samo zaključeni (= Analitika danes) ali tudi pretekli nezaključeni | tudi nezaključeni, **in enako spremenim Analitiko** (ena funkcija) |
| O5 | Številke samo lastnik ali stikalo za admina | samo lastnik zdaj; stikalo kasneje |
| O6 | Številke na glas ali samo na zaslonu | na glas, s stikalom »samo na zaslonu« (privzeto izklopljeno) |
| O7 | Opomniki: pg_cron vsako minuto ali n8n vsaki 2 min | **pg_cron vsako minuto** (±1 min, brez n8n) |
| O8 | »Popoldne/zjutraj« brez ure: vpraša ali privzeto (9:00 / 14:00) | privzeto, a vedno pove točen čas pred shranjevanjem |
| O9 | Zapolnitev: SMS strankam s privolitvijo (`marketing_consent = true`) dovoljen? | da, a samo z besedilom brez popusta; ostali samo klic |
| O10 | Samodejni jutranji povzetek privzeto izklopljen | da |
| O11 | Zapolnitev 4a zdaj, 4b (Prosti termini) ločeno | da |

### Odgovori 14. 11. 2026

- **O1:** da, 3 na stranko / 30 na podjetje na dan. SMS gre iz skupne SMS kvote podjetja (isti paket kot opomniki); omejitev je dodatna varovalka.
- **O2:** da, tudi e-pošta, ko stranka nima telefona.
- **O4:** da: zaslužek = zaključeni + pretekli neodpovedani termini do tega trenutka (brez neprihodov); **enako se spremeni stran Analitika**.
- **O5:** samo lastnik.
- **O6:** številke samo na zaslonu (govor: »Številke so na zaslonu.«), brez stikala.
- **O9, O10, O11:** da.
- **O3:** (a) vsak termin svoje potrdilo, brez spremembe n8n. Koledar (značka serije, odpovej/prestavi vse) po priporočilu hkrati z asistentom.
- **O7:** pg_cron vsako minuto (Tim preveri, ali je razširitev vklopljena).
- **O8:** (b) privzete ure (zjutraj 9.00, dopoldne 10.00, popoldne 14.00, zvečer 18.00), asistent vedno pove točen čas pred shranjevanjem.

## 9. Stanje izvedbe

| # | Funkcija | Stanje |
|---|---|---|
| 1 | Jutranji povzetek (`povzetek_dneva`) | narejeno, testi; brez migracije |
| 2 | Številke za lastnika (`stevilke_salona`) + Analitika na skupnem izračunu (`lib/analytics/izracun.ts`) | narejeno, testi; brez migracije |
| 3 | Sporoči stranki (`sporoci_stranki`) | narejeno; migracija, n8n tok in ključ nastavljeni, Tim preizkusil SMS |
| 4a | Zapolnitev luknje (`kandidati_za_luknjo`, `ponudi_prosti_termin`) | koda in testi narejeni; čaka migracijo `1793700001` (spodaj) |
| 5 | Osebni opomniki (`nov_opomnik`, `moji_opomniki`, `preklici_opomnik`) | koda in testi narejeni; čaka pg_cron in migracijo `1793700002` (spodaj) |
| 6 | Ponavljajoči termini | ni začeto |

### Spremembe na strani Analitika (O4)

- Prihodek, grafi storitev in zaposlenih štejejo zaključene **in** že končane neodpovedane termine (do tega trenutka), ne samo zaključenih.
- Vsi grafi zdaj računajo enako: »Final cena« → »cena« → cenik vseh storitev termina (glavna, 2., 3., dodatna).
- Izbrisani termini in »ne beleži« se ne štejejo več; branje ni več omejeno na 5000 neurejenih vrstic (po straneh).
- Stopnja zaključenosti ostaja »zaključeni / vsi«.

### Nepreizkušeno (1 in 2)

- Številke Analitike na pravi bazi in v brskalniku (primerjaj s staro stranjo; razlika je pričakovana zaradi novega pravila).
- Ali `Termini."ID storitve"` / `"ID Osebe"` kažeta na `id` ali na besedilni ID — koda išče po obeh, branje produkcije ni bilo dovoljeno.
- Povzetek dneva na pravem salonu (zahteve v pregledu, opombe strank, nove stranke).

### Sporoči stranki (3): kaj je narejeno

- Orodje `sporoci_stranki` (`lib/glas/orodja/sporocila.ts`), pravila v `lib/glas/sporocila/besedilo.ts`:
  - vedno vezano na termin (danes ali v 30 dneh, tudi odpovedan);
  - zavrne ponudbe, cene, povezave in telefonske številke (sl, en, de, it, hr);
  - en SMS (160 znakov brez šumnikov), podpis salona doda strežnik;
  - jezik stranke s kartice (drugačen jezik → model napiše znova).
- Telefon in e-naslov prebere strežnik z RLS, model ju ne vidi. Brez telefona gre e-pošta (O2).
- Pošlje se šele po potrditvi (gumb »Pošlji« ali »ja«; asistent vpraša »Pošljem?«). Ob potrditvi se vse preveri znova.
- Omejitev 3 na stranko in 30 na podjetje na dan je v SQL (`supabase/migrations/1793700000_glas_sporocila.sql`), SMS kvota pa v n8n.
- Po odpovedi: »obvesti stranko« pošlje samo, če je termin v bazi res odpovedan.
- n8n: nov tok »Asistent+ – sporočilo stranki« (webhook `glas-sporocilo`) v `~/n8n-backup/20261114-glas-sporocilo/`:
  - `zgradi.py`: kopija »Receptionist+ – SMS stranki«; e-pošta gre prek SES s `booking@jedroplus.com`;
  - `uveljavi.py`: ustvari in vklopi tok, obstoječih ne spreminja; `uveljavi.py nazaj` ga izklopi.

### Kaj mora narediti Tim (3)

1. Pognati migracijo `supabase/migrations/1793700000_glas_sporocila.sql`.
2. Ustvariti dolg naključen ključ in ga nastaviti kot `GLAS_N8N_HMAC_SECRET`:
   - na Vercelu;
   - v okolju n8n, nato n8n ponovno zagnati.
3. Reči »ja« za n8n, nato pognati `python3 ~/n8n-backup/20261114-glas-sporocilo/uveljavi.py`.
4. Preizkusiti na svoji številki (7LHB28): SMS, e-pošto (stranka brez telefona), kvoto in »obvesti stranko« po odpovedi.

### Nepreizkušeno (3)

- Nič ni bilo poslano zares; n8n tok ni naložen. Preizkušeno je samo z lažnim pošiljateljem in simulacijo podpisa HMAC.
- `message_outbox` z `entity_type 'glas_sporocilo'` in `channel 'email'`: ne vem, ali jih omejitve tabele dovolijo.
- SES vozlišče za e-pošto stranki: poverilnica in pošiljatelj sta prepisana iz bookinga, a nista preizkušena.
- `companies.name` za podpis bere uporabnikova seja. Če RLS zaposlenemu tega ne dovoli, je podpis prazen; n8n pri e-pošti vzame ime sam.
- Jezik sporočila je jezik s kartice stranke (brez → slovenščina); »Jezik pošiljanja« podjetja se ne upošteva.

### Zapolnitev luknje (4a): kaj je narejeno

- `kandidati_za_luknjo` (`lib/glas/orodja/zapolnitev.ts`, izbor v `lib/glas/zapolnitev/kandidati.ts`):
  - luknja iz dneva, ure in osebe; več možnih lukenj ali oseb → vprašanje; ob uri ni luknje → »najprej odpovejte termin v koledarju«;
  - do 5 strank: kasnejši termin pri isti osebi v 30 dneh, ki gre v luknjo → zapadle po ritmu (vsaj 3 obiski iste storitve, 1,0–1,5 × mediana razmika, brez prihodnjega termina) → navada (vsaj 2-krat v letu pri tej osebi ±90 min);
  - izločeni: prekrivajoč termin na ta dan, ≥ 2 neprihoda v letu, brez telefona; zaposleni s »samo svoji« vidi samo svojo luknjo in svoje termine;
  - zgodovina 18 mesecev po straneh (`zgodovinaTerminov`), brez omejitve 2000 vrstic;
  - model dobi imena, razloge in `sms_dovoljen`, telefon gre samo v gumbe »Pokliči« z imeni (do 5).
- Kasnejši termin: »pošlji ji predlog« → `sporoci_stranki` o njenem terminu (storitveno, brez privolitve).
- `ponudi_prosti_termin`: SMS (brez telefona e-pošta) o prostem terminu **samo** pri `marketing_consent = true` (O9):
  - brez popusta, cen, povezav (isti filter kot 3), podpis salona, potrditev »Pošljem?«;
  - ob potrditvi znova preveri privolitev, da je čas še prost, pravico in kontakt;
  - šteje v isto omejitev 3/30 na dan in SMS kvoto; v `glas_sporocila` z `id_termina = null`.
- Brez sprememb n8n (tok že sprejme prazen `termin_id`).

### Kaj mora narediti Tim (4a)

1. Pognati migracijo `supabase/migrations/1793700001_glas_sporocila_ponudba.sql` (`id_termina` sme biti prazen). Brez nje `ponudi_prosti_termin` ob potrditvi pade v SQL (nič se ne pošlje); kandidati delajo tudi brez nje.

### Nepreizkušeno (4a)

- Kandidati na pravih podatkih (ali ritem in navada najdeta smiselne stranke; hitrost branja 18 mesecev terminov).
- `ponudi_prosti_termin` zares (SMS brez termina skozi n8n in `message_outbox`).
- Gumbi »Pokliči« z imeni na telefonu.

### Osebni opomniki (5): kaj je narejeno

- Orodja v `lib/glas/orodja/opomniki.ts`:
  - `nov_opomnik`: datum + ura, del dneva (zjutraj 9.00, dopoldne 10.00, popoldne 14.00, zvečer 18.00 — O8), »čez X minut« ali ob naslednjem terminu stranke (60 dni);
  - pred shranjevanjem vedno točen dan, datum in uro; preteklost → »Ta čas je že mimo«; največ eno leto vnaprej in 50 čakajočih;
  - `moji_opomniki`: seznam po času;
  - `preklici_opomnik`: po besedah iz besedila (sklon: prve 4 črke), dvoumno → vprašanje; samo svoje (ime brez »izbris«, ker varnostni test asistentu prepoveduje orodja za brisanje).
- Čas v pasu podjetja (`lib/glas/opomniki/cas.ts`), testirano tudi za oba prehoda poletnega časa.
- Migracija `supabase/migrations/1793700002_glas_opomniki.sql`:
  - tabela `glas_opomniki`, RLS: vsak vidi samo svoje; piše samo strežnik prek `jp_glas_dodaj_opomnik` / `jp_glas_preklici_opomnik`;
  - `jp_glas_opomniki_tek()` vsako minuto (pg_cron): vstavi `notifications` za uporabnika (`type 'system'`, `entity_type 'glas_opomnik'`, `dedupe_key`) → obstoječi sprožilec pošlje push;
  - vezan na termin: prestavljen termin premakne opomnik; odpovedan ali izbrisan ga prekliče in o tem obvesti;
  - zamuda > 5 min → »(zamuda)«, starejši od 24 h → `potekel`; uporabnik ni več član → `preklican`;
  - pogled `glas_opomniki_zamuda` za nadzor.
- SQL testi (Docker): dva teka pošljeta enkrat, prestavljen/odpovedan termin, preklic samo svojega, RLS.
- Brez pusha asistent ob shranjevanju pove, da bo opomnik viden samo v obvestilih aplikacije.

### Kaj mora narediti Tim (5)

1. Supabase → Database → Extensions: vklopi **pg_cron**.
2. Pognati `supabase/migrations/1793700002_glas_opomniki.sql` (ob koncu nastavi opravilo `glas-opomniki` vsako minuto; brez pg_cron izpiše opozorilo).
3. Preizkus: »opomni me čez dve minuti, da pijem vodo« → push na telefonu in zapis v zvončku; drug uporabnik ga ne sme videti.

### Nepreizkušeno (5)

- Ali `notifications` sprejme zapis (stolpci, `dedupe_key` unikaten, omejitve na `type`/`entity_type`) — testirano na nadomestni tabeli.
- Push na telefon (PWA) in prikaz v zvončku/Obvestilih (`entity_type 'glas_opomnik'` nima posebne ikone ali povezave).
- `Termini."Datum"`/`"Čas"` v produkciji: tek ju bere kot besedilo (`left(…,10)::date`, `left(…,5)::time`).
- Ni še: asistent ob odprtju ne pove neprebranih opomnikov (§5 »Neprebran opomnik«) in »opomni Tino« (v2).

