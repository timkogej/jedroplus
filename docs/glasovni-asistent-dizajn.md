# Asistent+ — videz

13. 11. 2026. Commit `f573538` na `cx/glasovni-asistent-osnova` (ni pushano).

## Koncept

Asistent je **orb v barvah plusa** (vijolična → modra → turkizna). V jedru ima beli plus iz logotipa: »jedro« Jedro+.

| Stanje | Kaj se vidi |
|---|---|
| Mirovanje | Majhen orb (48/52 px) ob desnem robu, nad pasom obvestil (toast spodaj desno). Samo počasno dihanje, brez vrtenja in brez JS. |
| Vklop (tap) | Orb v 620 ms odplava na sredino in zraste (112 px telefon / 136 px računalnik). Ozadje se zamegli in rahlo zatemni (460 ms). Okoli roba zaslona se prižge živ sij (700 ms), ob vžigu se razširi val. |
| Poslušam | Orb utripa z glasnostjo mikrofona, rob se odebeli. Pod orbom se sproti izpisuje, kar uporabnik govori (s kazalcem). |
| Razmišljam | Hitrejše »tekoče« vrtenje plasti, plus se obrača po četrtinah, tri pike ob napisu. |
| Govorim | Orb utripa z glasom asistenta. Odgovor se izpisuje po besedah, približno sinhrono z glasom; ko asistent utihne, je viden ves. |
| Možnosti / predlog | Steklene kartice pod napisom (oštevilčene možnosti; predlog s Prekliči/Potrdi). |
| Obrazec | V ospredju je samo list obrazca na zamegljenem ozadju, z gradientnim robom. Orb gre v zgornji levi kot lista, desno od njega je kratek napis (sproten prepis ali zadnji odgovor). Izpolnjena polja se ob odprtju zasvetijo po vrsti, kasneje vsako polje, ki ga asistent dopolni z glasom. |
| Uspeh | Plus v orbu se zamenja s kljukico, ki se izriše, od orba se razširi turkizen val. Napis s kljukico (npr. »Super, termin je zapisan.«), asistent ga tudi izgovori. Obrazec izgine s svojo animacijo. |
| Konec | Sij ugasne, ozadje se odmegli, orb se vrne ob rob. |

Prikaz pogovora ni klepet. Vidni sta samo zadnji dve izjavi: prejšnja je manjša in zbledela, zadnja je velika. Vnos z besedilom je sekundarna tipka »Napišite«.

## Oblika plusa (14. 11., v izbiri)

Namesto kroga je asistent lahko **plus iz logotipa**, ki se ob glasu napihne proti krogu. Plus sta dve zaobljeni palici; ko se odebelita, skrajšata in zaoblita do iste mere, sta isti krog, zato je prehod zvezen (`plusOblika.ts`, testi v `tests/glas/plus-oblika.test.ts`).

| Stanje | Plus |
|---|---|
| Mirovanje | Gradient logotipa (vijolična → turkizna), počasno dihanje, barve počasi tečejo, vsakih ~7 s svetel lesk. Miška: kraki se rahlo raztegnejo. Brez JS. |
| Vklop | Plus se hitro napihne v krog in se odpre nazaj. |
| Poslušam | Kraki se nežno iztegujejo z glasom uporabnika. |
| Razmišljam | Kraki utripajo po vrsti v krogu. |
| Govorim | Napihuje se z glasom asistenta, vsak krak diha zase; običajen govor malo, poudarki do kroga. |
| Uspeh | Napihne se v krog s kljukico, nato nazaj v plus. |

Različice: `logo` (razmerja logotipa), `mehak` (debelejši, berljiv v 48 px), `zele` (zaobljen, močno napihovanje), `obris` (svetleča steklena cevka v obliki plusa: daljni in bližnji sij, notranji odsev, oster rob z barvami in svetla nit; rob se ob glasu odebeli; razmišljanje = svetel komet kroži po robu, oblika počasi diha; barve se vrtijo z `@property` kota gradienta, v mirovanju zamegljene plasti mirujejo).

Možnosti in predlog: steklena kartica z gradientnim robom; možnosti kot vrstice z inicialkami (tipke 1–9 izberejo na računalniku), predlog z naslovom, podrobnostmi in gumboma Prekliči/Potrdi; pod kartico namig za glas (`moznostiNamig`, `predlogNamig`). Izbira: `OBLIKA_PRIVZETA` v `AsistentVmesnik.tsx` (zdaj še `krog`). Primerjava: `/sl/glas-dizajn?primerjava=1`, posamezna: `?oblika=mehak`.

Oblika se računa v `requestAnimationFrame` samo med pogovorom in kratkimi prehodi; nato se zanka ustavi.

## Plasti (z-index)

aplikacija ≤ 56 · obrazci 60–100 · tančica 104 (ob obrazcu 59, pod listom) · sij roba 106 · prikaz 108 · orb 110.

## Datoteke

- `components/glas/ui/`:
  - `AsistentVmesnik.tsx`: sestava, položaji orba, napis ob obrazcu, napaka/uspeh ob orbu;
  - `AsistentOrb.tsx`: orb (vedno narisan v 144 px, premik in velikost samo prek `transform`);
  - `Tancica.tsx`: zamegljeno ozadje; tap konča pogovor;
  - `ObrobaZaslona.tsx`: sij roba, štirje trakovi z masko, barve tečejo s `translate`;
  - `PrikazPogovora.tsx`: napisi, izpis po besedah, kartice, tipkovnica (iPhone: nad zaslonsko tipkovnico prek `visualViewport`);
  - `useOkvirObrazca.ts`: okvir lista, sij polj, javljanje oddaje; `useListObrazca` (položaj lista);
  - `useNivoGlasu.ts`: glasnost → `--ap-nivo` (rAF samo med poslušanjem in govorom);
  - `asistent.css`: vsi slogi, izven `@layer`; `globals.css` ni spremenjen.
- `components/glas/AsistentPlus.tsx`: samo logika. Dodano:
  - uspeh po vrsti obrazca (»Super, termin je zapisan.« …);
  - ročni gumb Shrani v obrazcu, ki ga je odprl asistent, prav tako pokaže uspeh oz. asistent pove napako.
- `lib/glas/odjemalec/pogovor.ts`: samo `glasnost()` (branje). Na izhodu je `AnalyserNode` med glasom in zvočnikom; zvok ostane enak, `utisaj()` in odmev nista spremenjena.
- `app/[locale]/glas-dizajn/`: testna stran z lažnimi stanji. Samo v razvoju, na produkciji vrne 404.

## Obrazci ostanejo enaki ob ročni uporabi

Obrazcev ni bilo treba spreminjati. Vmesnik doda listu `data-ap-list`, ozadju pa `data-ap-ozadje`. Doda jih samo obrazcu, ki ga je odprl asistent (dogodek `useGlasovniObrazec`), in jih ob zaprtju odstrani. Shranjevanje teče vedno po poti obrazca: gumb Shrani ali `requestSubmit()`.

Popravek ob tem: list obrazca se ni našel, ko je bil viden drsnik (Windows, macOS z vedno vidnimi drsniki), ker `fixed inset-0` meri brez drsnika. Zdaj se primerja s `clientWidth`.

## Zmogljivost in dostopnost

- Animira se samo `transform` in `opacity`. `backdrop-filter` je statičen na tančici in steklenih karticah.
- V mirovanju teče le CSS dihanje. Med pogovorom teče rAF zanka za glasnost.
- `prefers-reduced-motion`: brez vrtenja, dihanja in utripa; premiki so takojšnji.
- `aria-live` (polite) dobi zaključeno izjavo in odgovor; sproten prepis ga ne dobi. Esc konča pogovor, v polju za vnos pa zapre samo vnos. Kartice imajo viden fokus. Besedilo na tančici je temno (kontrast > 6:1).

## Preizkušeno (13. 11.)

- `/sl/glas-dizajn` v brskalniškem podoknu, na računalniku (800 px in 1024 px) in telefonu (375×812):
  - mirovanje z obvestilom;
  - poslušanje, razmišljanje, odgovor, možnosti, predlog;
  - obrazec (sij polj ob odprtju in ob glasovnem »pri Luki«);
  - »ja« → uspeh;
  - napaka v mirovanju;
  - tipkovnica.
- `npx tsc --noEmit` je čist, `eslint` (glas, testna stran, pogovor.ts) je brez opozoril.
- `npx vitest run`: 235 testov gre skozi.
- `npx next build` uspe (v ločeni kopiji).

## Nepreizkušeno

- Pravi pogovor s prijavo:
  - utrip orba z mikrofonom in glasom (AnalyserNode);
  - pravi obrazci `AppointmentModal`, `AbsenceModal`, `ClientModal` in »Obvestim stranko?« z okvirjem asistenta;
  - uspeh po ročnem Shrani;
  - asistent pove napako po ročnem Shrani.
- Gladkost prehodov v vidnem zavihku: podokno je bilo med preizkusi skrito, zato je brskalnik zaviral animacije. Končni položaji so preverjeni.
- iPhone Safari in PWA:
  - varni robovi;
  - sij ob zaobljenih robovih zaslona;
  - tipkovnica nad vnosom;
  - zmogljivost `backdrop-filter`;
  - utrip med govorom.
- `prefers-reduced-motion` v pravem sistemu.
