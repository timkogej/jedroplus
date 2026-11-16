# Asistent+ — načrt nadgradnje

Dogovorjeno s Timom 12. 11. 2026, po prvem živem preizkusu osnove (deluje, a 3,9–11,6 s na ukaz,
včasih brez odgovora ali z »error«). Vrstni red: **hitrost in delovanje najprej, izgled na koncu.**

## Kaj gradimo

- Uporabljajo ga vsi (vse vloge), vsak samo v okviru svojih pravic.
- Deluje kot Siri: plavajoči gumb na vsaki strani → »bunka«, pogovor z glasom, asistent **odgovori z glasom**.
- Stran Asistent+ samo za nastavitve (jezik, glas …).
- Glas: isti kot Receptionist+ (Soniox »Nina«).
- Jeziki: sl, de, it, hr (+ en, ki ga aplikacija že ima).
- Cilj hitrosti: ~1 s do prvega zvoka pri preprostih vprašanjih, največ ~2 s pri težjih.
- Strošek na ukaz čim nižji, a pravilnost ima prednost.

### Funkcije

- **Branje:** pregled dneva, naslednja stranka, proste luknje, kdo dela, resursi, vse o stranki,
  zadnja barva/receptura, neaktivne stranke.
- **Dejanja (vedno s potrditvijo):** zapisek/receptura, nova stranka, popravek kontakta; termini
  (vpiši, prestavi, odpovej, ni prišla, zaključi), odsotnost, blokiran čas.
- **Sporočila strankam:** samo transakcijska; privolitev za marketing = null → nikoli marketinško;
  dva termina isti dan = dva SMS-a.
- **Luknje:** najprej »pokrij luknje« na ukaz, kasneje samodejno (povezano z `docs/prosti-termini-nacrt.md`).
- **Pomoč pri uporabi aplikacije** in premikanje po njej.
- **Ne:** poslovna analitika, brisanje strank/zgodovine, plačila, računi, vračila, cene, pravice.

## Faze

| Faza | Vsebina | Konec, ko … |
|---|---|---|
| 0 | Arhitektura in meritve: glasovni sklad Receptionist+, zakasnitve STT/LLM/TTS, drugi jeziki, strošek | Tim potrdi predlagano arhitekturo |
| 1 | Jedro pogovora A+: vse sproti (pretočni STT, konec govora, en klic AI, glas od prvega stavka), nadaljevanje pogovora, prekinitev, nikoli tihe napake, vsi jeziki, samodejni preizkus ~150 ukazov | cilji hitrosti in pravilnosti izmerjeno doseženi |
| 2 | Bralne funkcije + pomoč in premikanje po aplikaciji; zapiski vidni na kartici stranke | Tim preizkusi seznam ukazov |
| 3 | Dejanja s potrditvijo (glas »ja« + gumb); termini šele po popravku napak n8n in pravic na strežniku; sporočila; luknje na ukaz | Tim preizkusi |
| 4 | Izgled Siri: plavajoči gumb, bunka, sproti prepis, kartica potrditve, stran z nastavitvami; iPhone | Tim potrdi na telefonu in računalniku |
| 5 | Objava: vklop/kvota v nastavitvah, pravice v vmesniku, nadzor, beta v 1–2 salonih, PR | Tim reče »ja« |

## Način dela

- Vsaka faza ima cilje s številkami (npr. branje < 1,5 s do prvega zvoka, ≥ 95 % pravilnih imen, 0 tihih napak).
- Delo na veji `cx/glasovni-asistent-osnova`, majhni commiti, testi + samodejni preizkus.
- Tim preizkusi 10–15 min na danem seznamu ukazov in reče »naprej« ali »še ne«.
- Nič ne gre v živo brez Timovega »ja«.

## Tveganja

- 1 s z glasom je realna samo za najpreprostejša vprašanja.
- Razpoznava hr/it/de še ni izmerjena na pravih glasovih.
- iPhone (Safari) omejuje mikrofon in samodejno predvajanje.
- Glas zviša strošek na ukaz.

Rezultati faze 0: `docs/glasovni-asistent-faza0.md`.
