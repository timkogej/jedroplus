# Asistent+ (glasovni asistent) — stanje osnove

Veja `cx/glasovni-asistent-osnova` (worktree `.claude/worktrees/glasovni-asistent`), 12. 11. 2026.
Ni pushano, ni PR-ja, migracija ni pognana v produkciji. Analiza: `docs/glasovni-asistent-analiza.md`,
načrt: `docs/glasovni-asistent-nacrt.md`.

## Kaj je narejeno

| Del | Datoteke |
|---|---|
| Migracija: zastavica in nastavitve po podjetju/uporabniku, knjiga ukazov, predlogi z žetoni, poraba po mesecih, revizija, `stranke_zapiski`, RLS, SQL funkcije (rezervacija kvote, atomska potrditev, čiščenje), pogled `glas_zdravje_24h` | `supabase/migrations/1793500000_glasovni_asistent.sql` |
| Jedro (STT → hitra pot ali LLM z orodji → odgovor / vprašanje / predlog; potrditev, zavrnitev) | `lib/glas/jedro.ts`, `lib/glas/hitraPot.ts` |
| Ponudniki (menjava = okoljska spremenljivka): STT ElevenLabs Scribe, OpenAI, lažni; LLM Anthropic (Haiku 5.5), lažni; TTS brez / stub | `lib/glas/ponudniki/*`, `lib/glas/konfiguracija.ts` |
| Register orodij in pravice: `iskanje_stranke`, `zadnji_obisk`, `koledar_dan`, `prvi_prosti_termin`, `dodaj_zapisek` (s potrditvijo); rezervirani, izklopljeni `ustvari_termin`, `premakni_termin`, `preklici_termin` | `lib/glas/orodja/*`, `lib/glas/pravice.ts` |
| Razreševanje imen (skloni, brez šumnikov, napake prepisa, vprašanje pri več zadetkih), datumov, ur in prvega prostega termina | `lib/glas/razresevanje/*` |
| Shramba (service role samo za knjigo ukazov) in podatki salona (vedno uporabnikova seja → RLS) | `lib/glas/shramba/*`, `lib/glas/podatki/supabase.ts`, `lib/glas/streznik.ts` |
| API | `app/api/glas/ukaz`, `potrdi`, `zavrni`, `stanje` |
| Testna stran (ni v meniju) | `/glas-test` |
| STT testni nabor: 42 stavkov in primerjalna skripta (WER, imena, odtenki, zakasnitev, strošek) | `scripts/glas-stt-stavki.md`, `scripts/glas-stt-primerjava.mjs` |

Dodajanje orodja: nova datoteka v `lib/glas/orodja/` in ena vrstica v `registry.ts`; jedra se ne spreminja.

## Kaj je preizkušeno

- `npm test`: 56 testov (vitest), vsi uspešni. Pokrivajo:
  - imena v sklonih, datume, ure, hitro pot in prvi prosti termin;
  - pravice in register orodij;
  - kvoto, omejitev na minuto, strošek pod 0,3 centa, vračilo kvote ob napaki ponudnika;
  - potrditev: enkratna izvedba, dvojni klik, potek, napačen žeton, drug uporabnik, zavrnitev, spremenjeni parametri, odvzeta pravica;
  - varnost: injekcija v imenu stranke, `</ukaz>` v prepisu, tuj ID stranke, predlog drugega podjetja, zaposleni brez pravic, izmišljena orodja, neveljavni parametri.
- `npm run test:glas-sql`: 37 preverjanj migracije v Dockerju (Postgres 16 s Supabase vlogami), tudi dvakratni zagon migracije.
- `tsc --noEmit` brez napak. `eslint` brez napak; 156 opozoril je v obstoječi kodi.
- `next build` je uspešen (lokalno, z okoljem iz glavnega `.env.local`).

## Nepreizkušeno

- **Migracija v produkciji** — ni pognana.
- **Pravi klici STT/LLM.** Ključev v okolju ni, zato je vse preizkušeno samo z lažnimi ponudniki.
- **OpenAI STT parametri** (`/v1/audio/transcriptions`, `prompt`, `gpt-4o-mini-transcribe`). Napisani so po spominu, ker dokumentacija ni bila dostopna (403).
- **Cene STT v `lib/glas/poraba.ts`** so ocene.
- **`lib/glas/podatki/supabase.ts` na pravi bazi.** Imena stolpcev so vzeta iz OpenAPI metapodatkov.
  - Stolpci: `Termini."Čas"`, `Konec`, `deleted_at`, `Stranke.id` za razvrščanje, `absences.status`.
  - Preslikava `absences.employee_id` → `"ID osebe"`.
- **Testna stran v brskalniku** (prijava). Posebej snemanje na iOS Safari (MediaRecorder `audio/mp4`).
- **RLS z dejansko Supabase sejo.** SQL preizkusi uporabljajo nadomestke za `auth.uid()`.
- **Prvi prosti termin** ne upošteva resursov, bufferjev ali dogodkov z onemogočeno rezervacijo. Odgovor zato pove, da je okviren.

## Kaj mora narediti Tim

1. **Ključi** (Vercel, samo strežnik):
   - `ELEVENLABS_API_KEY` in/ali `OPENAI_API_KEY`;
   - `ANTHROPIC_API_KEY` (morda že obstaja zaradi predloga navodil);
   - neobvezno `GLAS_STT=elevenlabs|openai`, `GLAS_LLM_MODEL`, `GLAS_TTS=brez`.
2. **Posnetki:** posnemi stavke iz `scripts/glas-stt-stavki.md` (vsaj dva glasova, del s hrupom) in poženi:
   `node scripts/glas-stt-primerjava.mjs posnetki/ --namigi namigi.txt`.
   Na podlagi rezultata izberi `GLAS_STT`.
3. **Migracija:** poženi jo v Supabase (SQL editor), nato vklopi testno podjetje. Ukaz je v komentarju na koncu migracije:
   `insert into glas_nastavitve_podjetja (company_id, vklopljeno) values ('7LHB28', true)`.
   Zaposleni potrebujejo še `can_access_asistent_plus = true`.
4. **Preizkus:** odpri `/sl/glas-test`, preizkusi bralna vprašanja in en zapisek s potrditvijo. Preveri, ali se zapisek pojavi v `stranke_zapiski`.
5. **Odločitve:**
   - kje v vmesniku pokazati zapiske (kartica stranke še ne bere `stranke_zapiski`);
   - ali naj čiščenje `jp_glas_pocisti()` teče prek pg_cron ali cron poti;
   - cena dodatka.
6. **Healthchecks.io** (zunanji nadzor) še vedno ni nastavljen.

## Znana tveganja

- **Napake n8n** (analiza §7): `POSODOBITEV_STRANKE` ne shrani internih opomb in ponastavi `Obvestimo`/`Status`. Zato asistent piše v novo tabelo. Pred fazo 2 je treba te napake popraviti.
- **Pravice zaposlenih na obstoječih poteh** (n8n prek `/api/webhook`) se na strežniku ne preverjajo. Asistent jih preveri sam, a v fazi 2 (termini prek n8n) bo to treba urediti tudi na strežniku.
- **Razpoznava slovenskih imen** je največje vsebinsko tveganje. Brez posnetkov ni podatka, kako dobro deluje.
- **Ključi:** brez `ANTHROPIC_API_KEY` vsak ukaz razen hitre poti vrne »Asistent trenutno ne deluje« (kvota se vrne).
- **`package-lock.json`** je ob namestitvi vitesta precej spremenjen. Pred mergem preveri, da `npm ci` na Vercelu teče.

## Priporočen naslednji korak

Posnetki in primerjava STT (točka 2), nato migracija in preizkus na enem podjetju. Šele potem kartica stranke z zapiski in faza 2.
