# Asistent+ — faza 1: sprotni pogovor (prvi del)

12. 11. 2026. Arhitektura A iz `docs/glasovni-asistent-faza0.md`, potrdil Tim.

## Kaj je narejeno

| Del | Datoteke |
|---|---|
| **En krog AI:** bralna orodja vrnejo končni odgovor, drugega klica AI ni (~1,2 s manj). Vmesni korak ostane le iskanje stranke. Ob več strankah z istim imenom se takoj vpraša. | `lib/glas/jedro.ts`, `lib/glas/orodja/*` |
| **Odgovori za glas** (`govor`): ure z besedami (»ob pól enajstih«), datumi z dnevom (»jutri, v petek«), največ 5 terminov na glas, ostalo na zaslonu; možnosti se naštejejo; predlog konča s »Potrdim?«. | `lib/glas/govor.ts` |
| **AI z `effort: low`** (kot Receptionist+) | `lib/glas/ponudniki/llm.ts` |
| **Seja:** ob pritisku na gumb se preverijo prijava, pravica, vklop in kvota. Vrne kratkotrajna Soniox ključa (60 s) in namige. `{samo:"tts"}` vrne samo nov ključ za glas. | `app/api/glas/seja`, `lib/glas/ponudniki/soniox.ts` |
| **Pogovor v brskalniku:** mikrofon (16 kHz worklet) → Soniox STT neposredno → konec govora (+250 ms, da se premor sredi nareka združi) → `/api/glas/ukaz` → glas Nina neposredno → spet posluša. Po 8 s tišine se zapre. Tap med govorom ga prekine. »Ja«/»ne« potrdi ali zavrne predlog, ime izbere med možnostmi. Vsaka napaka se izpiše in izreče. | `lib/glas/odjemalec/*`, `public/glas/mikrofon-worklet.js` |
| **Hitra pot velja tudi sredi pogovora** (»kaj imam jutri«) | `lib/glas/jedro.ts` |
| **Obračun:** sekunde sprotnega STT in znaki TTS (Soniox) gredo v strošek ukaza | `lib/glas/poraba.ts`, `app/api/glas/ukaz` |
| **Varnostne glave:** `microphone=(self)` (prej `()` = prepovedano), CSP dovoli `wss://stt-rt.soniox.com` in `wss://tts-rt.soniox.com`; vdelane strani (chatbot, booking) ostanejo brez mikrofona | `next.config.ts` |
| Worklet ni preusmerjen na `/sl/...` | `proxy.ts` |
| Testna stran na sprotnem toku, z izmerjenimi časi pod vsakim odgovorom | `app/[locale]/glas-test` |

## Preizkušeno

- 82 testov (vitest):
  - en krog, govor (ure, datumi, možnosti), obračun, omejitev sekund od odjemalca;
  - izjave iz Soniox žetonov, »ja«/»ne« (»ja, ampak …« ni potrditev), izbira po imenu (Novak/Novinc), pretvorba zvoka.
- `tsc` in `eslint` sta čista. `next build` je uspešen.
- Kratkotrajni ključi (Node, pravi Soniox):
  - odprta STT povezava dela tudi po poteku ključa (70 s);
  - nov TTS govor po poteku vrne 401, zato brskalnik ključ za glas obnavlja vsakih 40 s.
- V brskalniku:
  - worklet iz 1 s zvoka pri 48 kHz in pri 44,1 kHz naredi točno 16.000 vzorcev;
  - CSP dovoli obe Soniox povezavi;
  - `/api/glas/seja` brez prijave vrne 401.

## Nepreizkušeno

- **Celoten pogovor z mikrofonom in zvočnikom.** Stran zahteva prijavo, okno brskalnika je bilo skrito. Preizkusi Tim.
- **iPhone Safari:** mikrofon, predvajanje, worklet.
- **Odmev:** med govorom gre v razpoznavo tišina. Ali zvočnik po koncu govora še »odmeva« v naslednjo izjavo (200 ms rep), ni preverjeno.
- **Prekinitev z glasom** (barge-in) še ni narejena, samo z dotikom. Najprej je treba preveriti odmev na telefonu.
- **Izmerjena hitrost v živo.** Ocena iz faze 0 je ~1,1 s po hitri poti in ~2 s z AI.

## Kaj mora narediti Tim

1. Vercel (samo strežnik): dodaj `SONIOX_API_KEY` (isti kot pri Receptionist+). Lokalno je že v `.env.glas`.
2. Preizkus: `/sl/glas-test` → tap → govori. Pod vsakim odgovorom sta »odgovor … ms · prvi zvok … ms«.

## Še v fazi 1

- Prekinitev z glasom (po preizkusu odmeva).
- Vsi jeziki (de/it/hr/en): poziv, govor, hitra pot, datumi.
- Samodejni preizkus ~150 ukazov s časi.
- Pretakanje besedila AI v glas (prihrani ~0,3 s pri odgovorih brez orodja).
