# Asistent+ — faza 0: meritve in predlog arhitekture

12. 11. 2026. Načrt: `docs/glasovni-asistent-nadgradnja-nacrt.md`. Skripte: `scripts/glas-meritve/`
(ključi samo iz okoljskih spremenljivk; Soniox ključ je isti kot pri Receptionist+).

## Kaj uporablja Receptionist+

- Razpoznava: Soniox sprotno (`stt-rt-v5`), konec govora zazna Soniox, Silero VAD za prekinitev.
- AI: Claude Haiku 5.5, razmišljanje izklopljeno, `effort: low`, začne že pred koncem govora (preemptive).
- Glas: Soniox `tts-rt-v2`, glas **Nina** (od 26. 10.; prej Maya), hitrost 1,04, govori sl/en/de/hr/it.
- Vse teče prek LiveKit (WebRTC) in Python strežnika.

## Meritve

### Razpoznava (Timovih 42 posnetkov, zvok poslan v realnem času)

| Ponudnik | Napaka po besedah | Imena | Odtenki | Konec govora zaznan po zadnji besedi |
|---|---|---|---|---|
| **Soniox sprotno + namigi** (`max_endpoint_delay_ms` 1000) | **4,6 %** | 33/34 | 17/19 | **0,62 s** (p90 0,69 s) |
| Soniox sprotno, najhitrejša nastavitev (500 ms, raven 3) | 7,6 % | 33/34 | 13/19 | 0,72 s (p90 1,29 s) |
| ElevenLabs + namigi (zdaj, po posnetku) | 5,3 % | 33/34 | 18/19 | — (šele ko je posnetek poslan: ~1,0 s) |

- Sprotni Soniox je vsaj tako natančen kot ElevenLabs. Besedilo je gotovo že med govorjenjem, ne šele po pošiljanju posnetka.
- »Najhitrejša« nastavitev je v resnici slabša: več napak in več predčasnih koncev (13/42 posnetkov).
- S priporočeno nastavitvijo je bil konec zaznan sredi stavka v 3/42 posnetkih (dolgi nareki s premori, »hm«). Faza 1 mora to obvladati: kratko počakati, ali uporabnik nadaljuje.
- Odpiranje povezave traja ~0,5 s, zato se povezava odpre ob pritisku gumba, še preden uporabnik začne govoriti.
- Soniox ima že `stt-rt-v6`; meril sem v5 (kot Receptionist+). v6 preverim v fazi 1.

### Drugi jeziki (okvirno)

Šest salonskih ukazov na jezik, sintetiziranih z glasom Nina in razpoznanih s Soniox:
de 5,4 %, it 8,9 %, hr 3,0 %, en 6,9 % napak; imena 11/11. Skoraj vse »napake« so samo zapis
(»10« namesto »zehn«, »g« namesto »Gramm«). **Sintetičen glas je optimističen** — pred objavo
potrebujemo vsaj ~10 pravih posnetkov na jezik (najbolje od govorcev teh jezikov).

### AI (Claude Haiku 5.5, 12–13 klicev na način)

| Način | Do prvega dela odgovora | Celoten klic |
|---|---|---|
| Zdaj (brez pretakanja), hladen prvi klic | — | 1,67 s |
| Zdaj (brez pretakanja) | — | 1,25 s (max 1,93 s) |
| Pretakanje + `effort: low` | 0,92 s | 1,24 s |
| En krog: podatki že v pozivu, pretakanje + `effort: low` | **0,85 s** | 1,12 s |

- AI ima spodnjo mejo ~0,85–0,95 s do prve besede. Vsak dodaten krog (orodje → odgovor) doda ~1,2 s.
  Zato je bil prej vsak bralni ukaz 2–3 kroga = 2,5–3,5 s samo za AI.
- Hladen klic na Anthropic je 1,7 s, ne 8 s. 8,1 s v živem preizkusu je bilo verjetno prevajanje
  strani v `next dev` ob prvem klicu, ne AI.

### Glas (Soniox Nina, `tts-rt-v2`)

| Način | Prvi zvok (mediana) |
|---|---|
| HTTP, nova povezava vsakič | 0,51 s (0,41–0,84 s) |
| **Stalna WebSocket povezava** | **0,37 s** (0,33–0,69 s) |

Vseh 5 jezikov deluje, enaka hitrost. Glas se predvaja sproti (ni treba čakati celega stavka).

### Kratkotrajni ključi

Soniox izda kratkotrajne ključe (npr. 60 s) za razpoznavo (`transcribe_websocket`) in za glas
(`tts_rt`). Preverjeno: oba vrneta 201. Brskalnik se tako lahko poveže na Soniox neposredno, glavni
ključ pa ostane samo na strežniku.

## Ocena hitrosti (od konca govora do prvega zvoka odgovora)

| Pot | Izračun | Skupaj |
|---|---|---|
| Zdaj | posnetek → STT → 2–3 krogi AI → besedilo | 3,9–11,6 s (izmerjeno) |
| **Hitra pot** (pogosta vprašanja brez AI: »kaj imam jutri«, »kdo je naslednji«, »kdo dela«) | konec govora 0,6 + podatki 0,1–0,2 + glas 0,37 | **~1,1–1,2 s** |
| **En krog AI** (podatki dneva pripravljeni ob odprtju bunke) | 0,6 + 0,1 + AI 0,9–1,0 + glas 0,37 | ~2,0 s; z začetkom AI pred potrjenim koncem govora ~1,6–1,8 s |
| Dejanje s potrditvijo | kot en krog AI → predlog | ~2 s do vprašanja »Potrdim?« |

Ob zaznanem koncu govora takoj zaigra kratek zvok ali »mhm«, da uporabnik ve, da ga je slišal.

**Iskreno:** 1 s je dosegljiva samo po hitri poti. Z AI je realno 1,6–2 s. Hitreje bi šlo samo z
manjšim/hitrejšim modelom drugega ponudnika (npr. OpenAI mini kot rezerva pri Receptionist+). To bi
lahko izmeril, a dodal bi še enega ponudnika podatkov.

## Ocena stroška na ukaz

| Del | Cena ponudnika | Na ukaz |
|---|---|---|
| Razpoznava (~8 s odprte povezave) | Soniox 0,12 $/h | ~0,03 centa |
| AI (~2.400 žetonov, predpomnjeno, en krog) | Haiku 0,10 $/M vhod | ~0,03–0,05 centa |
| Glas (~6 s odgovora) | Soniox ~0,70 $/h | ~0,12 centa |
| **Skupaj** | | **~0,2 centa** (hitra pot ~0,15 centa) |

Pri 400 ukazih na mesec je to ~0,80 $ na salon. Glas je največji del stroška, zato odgovori ostanejo kratki.

## Možne arhitekture

| | A: brskalnik ↔ Soniox neposredno | B: LiveKit + strežnik Receptionist+ | C: vse prek Vercela |
|---|---|---|---|
| Hitrost | najhitrejša (zvok ne gre čez naš strežnik) | hitra, preizkušena | najpočasnejša (Vercel ne drži WebSocketov, zvok v kosih) |
| Pravice / RLS | AI in podatki ostanejo v Next.js z uporabnikovo sejo (kot zdaj) | Python strežnik dela s service role → **krši pravilo 1**, razen če bi mu prenašali uporabnikovo sejo | ostane v Next.js |
| Zasebnost | zvok samo pri Soniox (kot Receptionist+); kratkotrajni ključ | zvok tudi prek LiveKit | zvok prek Vercela in Soniox |
| Prekinitev, VAD | sami v brskalniku (Soniox endpoint + VAD) | že narejeno | težko |
| Dodatni stroški/infrastruktura | nič | LiveKit minute, strežnik, WebRTC na vsaki strani | nič |

## Predlog: A

1. Pritisk na gumb → `/api/glas/seja` preveri prijavo, pravico, vklop in kvoto. Vrne kratkotrajna Soniox
   ključa ter vnaprej pripravljene podatke (današnji/jutrišnji koledar, namige).
2. Brskalnik odpre WebSocket za razpoznavo (z namigi) in za glas. Zvok teče neposredno k Soniox.
3. Sproti prepis → ob koncu govora gre besedilo na `/api/glas/ukaz` (pretočni odgovor):
   - hitra pot → stavek takoj;
   - sicer en krog AI s pretakanjem; prvi stavek gre takoj v glas.
4. Pisanje ostane enako kot zdaj: predlog z žetonom → potrditev (glas »ja« ali gumb) → `potrdi`.
5. Prekinitev: ko uporabnik začne govoriti, se glas ustavi (VAD v brskalniku).

Varnostna pravila osnove ostanejo:
- AI in podatki samo prek uporabnikove seje (RLS);
- vsako pisanje gre prek potrditve z žetonom;
- glavni ključi samo na strežniku;
- v dnevnike nič osebnih podatkov.

Nova je samo kratkotrajna Soniox poverilnica v brskalniku.

## Odprto za fazo 1

- Diagnoza »error« in tihih odgovorov iz živega preizkusa (stran ni pokazala, kaj se je zgodilo).
- Soniox `stt-rt-v6` proti v5.
- iPhone Safari: mikrofon, samodejno predvajanje, WebSocket v ozadju.
- Pravi posnetki v hr/it/de.
