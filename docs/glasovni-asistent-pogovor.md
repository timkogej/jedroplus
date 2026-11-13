# Asistent+ — gladek pogovor

13. 11. 2026. Cilj: pogovor kot z dobro receptorko (glasovni način ChatGPT ali Grok). Šteje delovanje in občutek, ne končni dizajn.

## 1. Analiza (stanje na ecca1b3)

### Konec govora — meritev
`scripts/glas-meritve/konec-govora.mjs`: sintetičen govor (Nina, 16 kHz) se pošilja v Soniox `stt-rt-v5` v realnem času. Premori sredi stavka trajajo 0,9–1,8 s. Preizkušene so štiri vrednosti `max_endpoint_delay_ms`.

| `max_endpoint_delay_ms` | Konec po celem stavku (mediana / največ) | Odrezani stavki s premorom |
|---|---|---|
| 500 | 469 / 700 ms | 6 / 6 |
| 1000 (dozdaj) | 488 / 689 ms | 6 / 6 |
| 1500 | 472 / 665 ms | 6 / 6 |
| 2000 | 469 / 669 ms | 6 / 6 |

- Soniox pošlje `<end>` približno 0,45 s po vsakem premoru. To velja tudi sredi stavka: »Zapiši nov termin za Anjo Novak ob.«, »Prestavi Matejo na.«, »Uh.«.
- `max_endpoint_delay_ms` na to ne vpliva. Uglaševanje te vrednosti problema ne reši.
- Dozdaj: po `<end>` je asistent čakal še 250 ms. Vsak premor nad ~0,7 s je zato odrezal stavek. Od tod »Zapiši termin ob.«.
- Soniox piko doda tudi sredi stavka (»jutri,« postane »jutri.«). Ločila zato niso zanesljiv znak, zadnja beseda pa je.

### Čas odgovora — eval s pravim modelom (Haiku, 16 izjav)
- LLM: 1,2–2,7 s, mediana ~1,6 s. Uspešnih 5 od 5 pogovorov.
- Skupaj od konca govora do prvega zvoka: ~0,45 s (Soniox) + 0,25 s (čakanje) + ~1,6 s (LLM) + ~0,37 s (prvi zvok TTS) ≈ **2,7 s**.

### Druge nerodnosti (iz kode)
- **Polovični dupleks:** med razmišljanjem in govorom je v STT šla tišina. Asistenta ni bilo mogoče prekiniti z glasom. Kar je uporabnik rekel med razmišljanjem, se je izgubilo.
- **Piski:** 880 Hz ob začetku in 660 Hz ob vsaki poslani izjavi.
- **Robotski odgovori:** »Preverite in shranite.«, »V obrazcu izberite še dan, uro.«
- **Shrani:** po »shrani« je asistent takoj rekel »Shranjujem«, izida pa ni povedal (»Shranjeno« je bil samo napis). Napak v obrazcu ni povedal.
- **»Obvestim stranko?«** je bil samo gumb.
- **Napake:** prekinjena razpoznava je končala pogovor. Napake je asistent prebral v celoti (»… Nič ni bilo spremenjeno. Poskusite znova.«).
- **Krogec:** ostal je v kotu. Ob obrazcu se je skrčil v pilulo na vrhu zaslona.
- **Konec pogovora:** samo tap ali tišina, ne »hvala, to je vse«.

## 2. Načrt in izvedba

Čista logika je v `lib/glas/odjemalec/tok.ts` (testi `tests/glas/tok.test.ts`). Pogovor v brskalniku je v `lib/glas/odjemalec/pogovor.ts`.

1. **Konec govora po vsebini** (`cakanjePoKoncu`):
   - stavek se konča s predlogom, veznikom ali mašilom (»ob«, »za«, »pri«, »na«, »in«, »uh«, »ehm« …), z vejico ali s pomišljajem: čaka 2,2 s;
   - samo mašilo: čaka 2,6 s;
   - kratek odgovor (do 3 besede: »ja«, »shrani«): čaka 0,15 s;
   - drugače: čaka 0,35 s.
2. **Nadaljevanje med razmišljanjem:** asistent posluša tudi, ko razmišlja. Če uporabnik nadaljuje, preden asistent spregovori, se zahteva prekliče in izjavi se združita. Premor sredi nareka tako ostane del iste izjave, tudi kadar pravilo iz točke 1 ne zadene.
3. **Prekinitev z glasom (barge-in):**
   - Med govorom gre v STT pravi mikrofon z odmevnim izničevanjem brskalnika.
   - Prekinitev šteje (`jePrekinitev`), če sta izpolnjena oba pogoja:
     - slišani sta vsaj 2 besedi, ki ju asistent ravno ne govori, ali ena jasna (»stop«, »počakaj«, »ne«, »ja«);
     - mikrofon je v zadnjih 0,6 s dosegel prag glasnosti.
   - Odmev skozi zvočnik da besede iz asistentovega stavka, zato ne prekine.
   - Kar Soniox prepiše iz zvoka med govorom in še 0,35 s po njem, ne gre v novo izjavo (časovnica zvoka, `end_ms`).
4. **Zvoki:** piskov ni več.
   - Ob začetku je komaj slišen mehak namig.
   - Med razmišljanjem utripa krogec.
   - Če odgovor zamuja več kot 2,5 s, asistent reče »Moment.«, »Samo trenutek.« ali »Preverim.« (pripravljeno vnaprej, brez zamika).
5. **Kratki odgovori:**
   - Obrazci povedo podatke in vprašajo »Shranim?«. Če kaj manjka, vprašajo samo to (»Za kdaj?«, »Katera storitev?«).
   - Napaka se izgovori samo s prvim stavkom.
   - »Hvala« da odgovor »Prosim.«, »hvala, to je vse« pa »Prav. Lep dan.« in konec pogovora.
6. **Obrazci:**
   - Krogec gre v zgornji levi kot obrazca: nad njim, če je prostor, sicer na sam kot.
   - »Ja« ali »shrani« sproži `requestSubmit()`. Asistent nato pove izid: »Shranjeno.« ali napako s polja (npr. »Izberite storitev.«).
   - Po prestavitvi vpraša »Obvestim stranko?«. »Ja« sproži isti gumb Pošlji, »ne« zapre.
   - To velja samo za obvestilo po prestavitvi, ki je bila odprta z glasom.
7. **Krogec:**
   - v mirovanju je v kotu;
   - ob pogovoru gre na sredino zaslona (»način pogovora«), z napisi in karticami pod njim;
   - ob obrazcu gre v kot obrazca;
   - ko se obrazec zapre, se vrne na sredino;
   - ob koncu pogovora se vrne v kot.
8. **Celovitost:**
   - Če se razpoznava prekine, se enkrat poveže znova, brez konca pogovora.
   - Glas (TTS) se pred govorom po potrebi poveže znova.
   - Napake strežnika in LLM asistent pove kratko in posluša naprej.

Rezultati in seznam za preizkus so na koncu dokumenta (razdelek 3).
