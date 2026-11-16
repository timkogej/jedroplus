# Glasovni asistent (Asistent+) — načrt arhitekture

Datum: 12. 11. 2026 · temelji na `docs/glasovni-asistent-analiza.md`

## 0. Povzetek odločitev

| Področje | Odločitev |
|---|---|
| Kje teče | Next.js API poti na Vercelu (`runtime = 'nodejs'`), brez novega strežnika |
| Jedro | `lib/glas/` — en sam `obdelajUkaz()` za vse vhode (aplikacija zdaj, Telnyx klic pozneje) |
| Branje | Z **uporabnikovo sejo** (RLS velja) + plast pravic asistenta |
| Pisanje (faza 1) | Samo nova tabela `stranke_zapiski`; zapis z uporabnikovo sejo, RLS preveri članstvo in `can_edit_clients` |
| Pisanje (faza 2+) | Prek obstoječih n8n dogodkov s strežnika, z istimi preverjanji kot `/api/webhook` — **rezervirano, nepovezano** |
| LLM | `claude-haiku-5-5` (najcenejši, tool use), brez razmišljanja, predpomnjen sistemski del, ≤3 krogi orodij |
| STT | Vmesnik + ElevenLabs Scribe v2 + OpenAI (`gpt-4o-mini-transcribe`) + lažni; izbira z `GLAS_STT` |
| TTS | Vmesnik + „brez“ (privzeto) + stub; izbira z `GLAS_TTS` |
| Potrditev | Predlog v bazi, enkratni žeton (v bazi samo SHA-256), potek 120 s, hash parametrov, atomarna izvedba |
| Kvote | Mesečni števec po podjetju, atomarna rezervacija v SQL, 80 % opozorilo, 100 % blokada |
| Zvok | Ne shranjujemo; prepis 30 dni |

## 1. Tok

```
[mikrofon v PWA] ──audio/webm|mp4──▶ POST /api/glas/ukaz ◀── (pozneje) Telnyx klic → /api/glas/telnyx
                                        │
   1. seja (cookie)  ─┐  vzporedno      │
   2. kontekst člana ─┤  (Promise.all)  │  vloga, pravice, person_id, lokacije, nastavitve glasu
   3. omejitev+kvota ─┘                 │  rezervira 1 ukaz (fail closed)
   4. STT (namigi: storitve, osebe, današnje stranke, barvni izrazi; ≤100 izrazov)
   5. hitra pot brez LLM? („kaj imam jutri/danes“) ──da──▶ orodje koledar_dan
   6. LLM z orodji (Haiku): bralna orodja se izvedejo takoj (≤3 krogi)
                            pisalno orodje → PREDOG (ne izvede)
   7. odgovor: besedilo + (izbirno) kartica predloga {predlog_id, zeton, povzetek, poteče}
   8. zapis ukaza: prepis, stroški (STT s, žetoni, TTS znaki), trajanja, izid
                                        │
[kartica „Potrdi“] ───────────────▶ POST /api/glas/potrdi {predlog_id, zeton}
   preveri: lastnik predloga, žeton, potek, hash parametrov, pravico ZNOVA
   atomarno: status caka → izvaja (UPDATE … WHERE status='caka' RETURNING)
   izvedi orodje.izvedi() → status izvedeno + rezultat; napaka → napaka (nič pol-izvedenega)
   ponovni klic z istim žetonom → vrne shranjeni rezultat (idempotenca)
```

## 2. Datoteke

```
lib/glas/
  tipi.ts                  skupni tipi (Kontekst, Orodje, Predlog, Rezultat …)
  konfiguracija.ts         branje env: GLAS_STT, GLAS_LLM, GLAS_TTS, modeli, meje
  jedro.ts                 obdelajUkaz(): STT → hitra pot / LLM → odgovor
  hitraPot.ts              pravila brez LLM (regex po normaliziranem besedilu)
  pravice.ts               lahkoUporablja(kontekst, orodje)
  potrditev.ts             ustvariPredlog, potrdiPredlog (logika, neodvisna od baze)
  poraba.ts                cenik in izračun stroška, preverjanje kvote
  razresevanje/
    besedilo.ts            normalizacija (šumniki, sklanjatve, števila z besedo)
    imena.ts               fuzzy ujemanje strank/storitev/oseb
    datumi.ts              „jutri“, „v petek“, „15. 11.“, „ob treh popoldne“ → Europe/Ljubljana
    urnik.ts               prosti termini iz urnika, terminov, odsotnosti
  orodja/
    registry.ts            seznam orodij; dodaš novo = nova datoteka + 1 vrstica
    iskanjeStranke.ts      R
    zadnjiObisk.ts         R
    koledarDan.ts          R
    prviProstiTermin.ts    R
    dodajZapisek.ts        W (faza 1)
    rezervirano.ts         ustvari/premakni/prekliči termin — W/S, onemogočeno
  ponudniki/
    stt.ts                 vmesnik + izbira
    sttElevenlabs.ts, sttOpenai.ts, sttLazni.ts
    llm.ts                 vmesnik + izbira; llmAnthropic.ts, llmLazni.ts
    tts.ts                 vmesnik + „brez“ + stub
  shramba/
    tipi.ts                vmesnik Shramba (predlogi, ukazi, kvote, revizija) in PodatkiSalona (branje/pisanje domene)
    supabase.ts            produkcijska izvedba
    pomnilnik.ts           izvedba v pomnilniku (testi)
app/api/glas/
  ukaz/route.ts            POST (multipart audio ali JSON {besedilo})
  potrdi/route.ts          POST
  zavrni/route.ts          POST
  stanje/route.ts          GET (vklopljeno, poraba, meja)
app/[locale]/glas-test/page.tsx   minimalen preizkusni vmesnik (le z vklopljenim flagom)
supabase/migrations/1793500000_glasovni_asistent.sql
scripts/glas-stt-primerjava.mjs   primerjava STT ponudnikov na posnetkih
scripts/glas-stt-stavki.md        40 stavkov za snemanje
tests/glas/*.test.ts               vitest
```

## 3. Registracija orodij

```ts
interface Orodje<P> {
  ime: string;                       // 'dodaj_zapisek'
  opis: string;                      // za LLM
  shema: JSONSchema;                 // strict, additionalProperties:false
  razred: 'branje' | 'pisanje' | 'mnozicno' | 'sporocila';
  pravica: Pravica;                  // npr. 'stranke.urejanje' → can_edit_clients
  omogoceno: boolean;                // faza 2 = false
  validiraj(vhod: unknown): P;       // zod; vrže NapakaVhoda
  izvedi?(p: P, k: Kontekst): Promise<Rezultat>;        // samo branje
  predogled?(p: P, k: Kontekst): Promise<Predogled>;    // pisanje: povzetek + razrešeni parametri
  potrdi?(p: P, k: Kontekst): Promise<Rezultat>;        // pisanje: izvedba po potrditvi
}
```

Pravila jedra (ne orodij): pisalno orodje brez `predogled`+`potrdi` se ne registrira; jedro **nikoli** ne kliče `potrdi` mimo `/api/glas/potrdi`; LLM vidi le orodja, ki jih uporabnik sme in so omogočena.

## 4. Plast pravic

| Pravica asistenta | owner/admin | staff |
|---|---|---|
| `glas.uporaba` | da | `can_access_asistent_plus` |
| `stranke.branje` | da | `can_view_clients` |
| `stranke.urejanje` | da | `can_edit_clients` |
| `termini.branje` | da (vse) | `can_view_all_appointments` ali `can_view_only_own_appointments` (filter po `person_id`) |
| `termini.urejanje` (faza 2) | da | `can_edit_all_appointments` / `…only_own…` |
| `termini.ustvarjanje` (faza 2) | da | `can_create_appointments` |

Dodatno: `glas_nastavitve_uporabnika.vklopljeno=false` (lastnik izklopi posameznika) → zavrnjeno. Lokacije: branje z uporabnikovo sejo že omejuje RLS (`jp_ima_dostop_do_lokacije`). Pravica se preveri ob predlogu **in** ob potrditvi (lahko se je vmes spremenila). V bazi je isto pravilo zapisano v SQL funkciji `jp_glas_ima_pravico(company_text, pravica)` za RLS na `stranke_zapiski`.

## 5. Potrditvena plast

Tabela `glas_predlogi`: `id`, `company_id`, `user_id`, `ukaz_id`, `orodje`, `parametri` (jsonb), `parametri_hash` (sha256 kanonične JSON oblike), `zeton_hash`, `povzetek`, `status` (caka/izvaja/izvedeno/napaka/zavrnjeno/poteklo), `poteče`, `rezultat`, `napaka`, časi.
- Žeton: 32 naključnih bajtov (base64url), odjemalec ga dobi enkrat, v bazi le hash. Primerjava v konstantnem času.
- Potek: 120 s (`GLAS_PREDLOG_POTEK_S`).
- Prehod `caka → izvaja` je atomaren (`UPDATE … WHERE id=? AND status='caka' AND poteče>now() RETURNING`). Če ne uspe: izvedeno → vrni shranjeni rezultat (idempotenca); izvaja → 409 „že v teku“; poteklo/zavrnjeno → 410.
- Hash parametrov se preveri pred izvedbo (varovalka pred spremembo vrstice).
- Razveljavitev: zapisek ima `preklican_at` (mehki preklic avtorja v 10 min) — faza 1 shrani podatek, gumb pozneje.

## 6. Razreševanje imen in datumov

- Normalizacija: male črke, odstranjeni šumniki za primerjavo (č→c), ločila stran.
- Sklanjatve: kandidatne osnove z odrezom končnic (`-a, -e, -i, -o, -u, -om, -em, -ovi, -ovo, -evi, -ijo, -jo` …) in preverjanje predpone; „Ani/Anji/Ano/Ane“ → „ana/anja“.
- Ocena: Jaro-Winkler na ime in priimek posebej + bonus za točno ujemanje priimka; prag 0,86.
- Izid: `enolicno` (najboljši ≥0,92 in razlika do drugega ≥0,06), `vec` (vrni do 5, asistent vpraša), `nic`.
- Datumi: vedno Europe/Ljubljana (ali `Podatki podjetij.timezone`), poletni čas prek `Intl`; relativni izrazi (danes, jutri, pojutrišnjem, v ponedeljek = naslednji, ta/naslednji teden), absolutni („15. 11.“, „15. novembra“), ure („ob treh“ → 15:00, če je 3:00 izven delovnega časa; „pol štirih“ = 15:30). Asistent v odgovoru vedno pove dan v tednu in datum.

## 7. Abstrakcija ponudnikov

```ts
interface SttPonudnik { ime; prepisi(zvok: Blob, o: {jezik:'sl', namigi:string[]}): Promise<{besedilo, sekunde}> }
interface LlmPonudnik { ime; pogovor(z: LlmZahteva): Promise<LlmOdgovor> } // tool use, poraba žetonov
interface TtsPonudnik { ime; govor(besedilo): Promise<{zvok: ArrayBuffer, znaki}> }
```
Izbira: `GLAS_STT=elevenlabs|openai|lazni`, `GLAS_LLM=anthropic|lazni`, `GLAS_TTS=brez|stub`.

Kandidati STT za slovenščino (cene **preveri** pred odločitvijo):
| Ponudnik | Namigi | Ocena cene / 10 s | Opomba |
|---|---|---|---|
| ElevenLabs Scribe v2 | `keyterms` (≤100 brez minimalnega obračuna; +20 %) | ~0,1 cent | Že imaš račun |
| OpenAI gpt-4o-mini-transcribe | `prompt` (prost tekst) | ~0,05 cent | Najcenejši |
| Soniox, Google Chirp 3, Azure (sl-SI, phrase lists) | da | 0,05–0,3 cent | Kandidati za drugi krog |

Kriteriji: (1) pravilnost imen strank (≥95 % po fuzzy), (2) številke odtenkov in odstotki („6.3“, „6 %“), (3) WER, (4) čas odziva p50/p90, (5) cena, (6) EU obdelava/DPA.

## 8. Podatkovni model (migracija `1793500000_glasovni_asistent.sql`)

| Tabela | Namen | RLS |
|---|---|---|
| `glas_nastavitve_podjetja` | flag `vklopljeno`, `mesecna_kvota`, `tts_vklopljen`, `hramba_prepisov_dni` | branje: člani; pisanje: samo service role |
| `glas_nastavitve_uporabnika` | lastnik izklopi glas posamezniku | branje: član podjetja; pisanje: owner/admin |
| `glas_ukazi` | en ukaz: vhod, prepis, izid, trajanja, stroški | branje: owner/admin vse, ostali svoje; pisanje: service role |
| `glas_predlogi` | potrditve | branje: lastnik predloga; pisanje: service role |
| `glas_poraba_mesec` | števec po podjetju in mesecu (`ukazi`, `stt_sekunde`, `vhodni/izhodni žetoni`, `tts_znaki`, `strosek_mikrocent`) | branje: owner/admin |
| `glas_revizija` | revizijska sled (kdo, kaj, orodje, izid, brez osebnih podatkov v čistem besedilu) | branje: owner/admin |
| `stranke_zapiski` | zapiski na kartici stranke | branje: `stranke.branje`; vstavljanje: `stranke.urejanje`; brisanja ni |

SQL funkcije: `jp_glas_ima_pravico(text,text)`, `jp_glas_rezerviraj_ukaz(uuid, text, int)` (atomarno: preveri flag + kvoto + omejitev hitrosti, poveča števec), `jp_glas_zakljuci_ukaz(...)` (prišteje stroške), `jp_glas_pocisti()` (hramba).

## 9. Merjenje

- Cenik ponudnikov v `poraba.ts` (mikrocenti; ena tabela, menjava cene = ena vrstica).
- Vsak ukaz zapiše: `stt_sekunde`, `llm_vhod`, `llm_vhod_predpomnjen`, `llm_izhod`, `tts_znaki`, `strosek_mikrocent`, `trajanje_ms` po korakih.
- Kvota: rezervacija **pred** STT (ne plačamo ponudnika, če je kvota polna). 80 % → odgovor vsebuje `opozorilo`, 100 % → 402 „Mesečna kvota glasovnih ukazov je porabljena (400/400). Nova se začne 1. 12.“.
- Neuspel ukaz zaradi ponudnika se ne šteje v kvoto (vrnitev rezervacije), strošek se vseeno zapiše.

## 10. Hitrost (cilj ≤3 s do predloga)

| Korak | Cilj | Kako |
|---|---|---|
| Seja + kontekst + kvota | 150 ms | `Promise.all` |
| Namigi za STT | 0 ms | vzporedno s prenosom; predpomnjeno 5 min v pomnilniku instance |
| STT (5–8 s posnetka) | 0,8–1,5 s | sinhroni REST |
| Hitra pot | 50 ms | brez LLM |
| LLM 1–2 kroga | 0,6–1,2 s | Haiku, kratek izhod, predpomnjen sistem+orodja |
| Skupaj | 1,8–3 s | |

Streaming STT/LLM v 1. izdaji ne prinese veliko (kratki ukazi); pripravljeno za pozneje (Telnyx).

## 11. Zanesljivost in napake

- Časovne omejitve: STT 10 s, LLM 12 s, celotna zahteva 25 s (`maxDuration = 30`).
- Ponovni poskus: 1× z zamikom 300 ms + naključje pri 429/5xx/omrežju (STT in LLM); SDK Anthropic `maxRetries: 1`.
- Odpoved ponudnika → `{ok:false, koda:'stt_ni_na_voljo'|'llm_ni_na_voljo'}` + slovensko sporočilo; nič se ne zapiše, kvota se vrne.
- Pisanje samo v potrditvi; potrditev je ena transakcija za zapiske. Za n8n (faza 2): po klicu čakanje na zapis (kot `confirmWrite`), sicer status `negotovo` in jasen opis.
- Omejitve: zvok ≤ 1 MB in ≤ 30 s, tipi `audio/webm|mp4|mpeg|ogg|wav`; besedilo ≤ 500 znakov; 10 ukazov/min/uporabnik (v SQL rezervaciji).
- Prazen/nerazumljiv prepis (<2 besedi ali samo šum) → „Nisem razumel, ponovite prosim.“ in se ne šteje v kvoto.

## 12. Varnost

- Prompt injection: opombe, imena, prepis so **podatki** — v orodnih rezultatih v oznakah `<podatki>`, sistemski poziv to izrecno pove; LLM nima orodij za brisanje/pošiljanje; vsako pisanje gre skozi potrditev, ki jo izvede človek; parametre predloga strežnik znova validira (zod) in razreši ID-je sam (LLM ne more podtakniti tujega ID-ja, ker se stranka preveri z uporabnikovo sejo/RLS).
- Izolacija: `company_id` vedno iz seje, nikoli iz zahteve; vsa branja z uporabnikovo sejo.
- Minimizacija: LLM dobi prepis + največ 5 kandidatov (ime, priimek, zadnji obisk), nikoli telefona/e-pošte. STT namigi: le imena (ne telefoni).
- Dnevniki: brez prepisa in imen; samo ID-ji, kode, trajanja.
- Hramba: zvok se ne shrani; prepis `hramba_prepisov_dni` (30) → `jp_glas_pocisti()` (dnevni cron). GDPR: izbris po zahtevi = izbris vrstic `glas_ukazi` po `user_id`/omembi stranke; zapiske strank briše lastnik ob izbrisu stranke (kaskada po `ID stranke` v faza 2 — **odprto**).
- Obvestilo: v pogojih (DPA) dodati STT/LLM ponudnika kot obdelovalca (**tvoja naloga**).

## 13. Opazovanje

- Strukturirani dnevniki `console.info(JSON.stringify({glas:..., koda, ms}))` (Vercel).
- Metrike iz `glas_ukazi`: delež napak po ponudniku, p50/p90 trajanja, strošek/ukaz — SQL pogledi v migraciji.
- Opozorila: dnevni cron (Vercel) izračuna delež napak zadnje ure; ob >20 % pošlje push lastniku sistema + ping na healthchecks.io `/fail` (ločen sistem, ne isti strežnik). **Nepreizkušeno, v fazi 1 samo pogled.**

## 14. Faze

| Faza | Obseg |
|---|---|
| **Osnova (ta naloga)** | Migracije, API, ponudniki, registry, pravice, potrditev, kvote, orodja: iskanje stranke, zadnji obisk, koledar dan, prvi prosti termin, dodaj zapisek; preizkusni vmesnik; STT primerjava; testi |
| 1b | Zapiski na kartici stranke v `ClientDetailsPanel`, gumb mikrofona v AppBar, PWA iOS preizkus |
| 2 | Ustvari/premakni/prekliči termin, blokade, nova stranka prek n8n (po popravku n8n in tvoji potrditvi) |
| 3 | Množične spremembe + obvestila (transakcijska), poročilo o delni izvedbi |
| 4 | Telnyx klic (isto jedro, druga avtentikacija: številka zaposlenega + PIN), TTS |
| 5 | Poslovni pregled, paketi, prerazporeditev |

## 15. Tveganja

| Tveganje | Ukrep |
|---|---|
| Napačno ime (STT) | Namigi + fuzzy + vprašanje pri dvoumnosti + potrditvena kartica z imenom in zadnjim obiskom |
| Napačen datum/ura | Dan v tednu v vsakem odgovoru; dvoumne ure po delovnem času |
| Zaobid pravic | Pravice v asistentu + RLS na novih tabelah + branje z uporabnikovo sejo |
| Dvojna izvedba | Atomaren prehod statusa, hash žetona, idempotenten odgovor |
| Strošek uide | Kvota pred STT, omejitev hitrosti v SQL, cenik v kodi, strošek na ukaz |
| Ponudnik odpove | Časovne omejitve, 1 ponovitev, jasno sporočilo, kvota vrnjena |
| Prompt injection | Podatki v oznakah, brez nevarnih orodij, potrditev človeka |
| n8n napake (Interne opombe, Obvestimo) | Asistent ne uporablja te poti; poročano |
| Prosti termin brez resursov | Odgovor označen kot okviren |
| Redis izpad | Omejitev v bazi, ne v Redisu |
| Monitoring na istem strežniku | Healthchecks.io zunaj; Vercel cron |
| Hramba osebnih podatkov | Zvok ne, prepis 30 dni, dnevniki brez vsebine |
