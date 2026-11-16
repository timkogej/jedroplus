# Asistent+ — faza 2: bralne funkcije, pomoč, premikanje

13. 11. 2026. Nadaljuje `docs/glasovni-asistent-faza1.md`.

## Kaj je narejeno

| Funkcija | Orodje | Hitra pot (brez AI) |
|---|---|---|
| Naslednja stranka (moja ali celega salona; če danes ni več, pove naslednji dan) | `naslednja_stranka` | »kdo je naslednja«, »kdo je moja naslednja stranka« |
| Proste luknje na dan (delovni čas − termini − odsotnosti, od zdaj naprej) | `proste_luknje` | »kdaj imam danes prosto«, »ali imam jutri kaj prostega« |
| Kdo dela in od kdaj do kdaj, odsotni posebej | `kdo_dela` | »kdo dela jutri« |
| Zasedenost resursov (prek `Termini_Resursi`, upošteva količino) | `resursi_dan` | — |
| Vse o stranki: zadnji in naslednji obisk, zadnji zapiski, interne opombe | `kartica_stranke` | — |
| Zadnja barva oziroma receptura (iz glasovnih zapiskov) | `zadnja_barva` | — |
| Neaktivne stranke (brez obiska več kot N mesecev in brez termina) | `neaktivne_stranke` | — |
| Pomoč pri uporabi aplikacije: 15 vnaprej napisanih navodil, AI samo izbere temo | `pomoc_aplikacija` | — |
| Odpiranje strani in kartice stranke | `odpri_stran` | »odpri koledar«, »pojdi na nastavitve« |
| **Zapiski na kartici stranke:** nov razdelek »Zapiski« (barva, preferenca, opomba, »z glasom«) | `components/clients/ZapiskiStranke.tsx` | — |
| Stran Stranke odpre kartico iz povezave `?stranka=ID` | `app/[locale]/clients/ClientsClient.tsx` | — |

Ostalo:
- Vsa nova orodja dajo en sam odgovor (en krog AI). Zapiski in interne opombe zato ne gredo nazaj ponudniku AI.
- Zaposleni s pravico »samo svoji termini« vidi samo svoj urnik in svoje luknje.
- Brez telefonov in e-pošte.
- Poziv AI: za vprašanja o aplikaciji uporabi pomoč, za »odpri« uporabi premik. Poslovne analitike ne dela, ampak napoti na stran Analitika.
- Testna stran: pod odgovorom s premikom je povezava »Odpri«. Samodejni premik pride v fazi 4 s plavajočo bunko, sicer bi se pogovor ob premiku ustavil.

## Preizkušeno

- 107 testov (vitest), od tega 25 novih v `tests/glas/faza2.test.ts`.
- `tsc` je čist. `eslint` na spremenjenih datotekah ne da nobene nove napake.
- Strani `/sl/clients` in `/sl/glas-test` se prevedeta (200).

## Nepreizkušeno

- **Na pravih podatkih:**
  - resursi (`Termini_Resursi.termin_id` = `Termini.id`, kot v koledarju);
  - interne opombe;
  - razdelek »Zapiski« na kartici;
  - odpiranje kartice prek `?stranka=`.
- »Neaktivne stranke« se računajo po polju `Zadnja interakcija`. Če to polje ni ažurno, je seznam okviren.
- Navodila za pomoč so napisana po oznakah v vmesniku, a niso preverjena klik za klikom.

## Najdba: lokalni Upstash ne obstaja

`/api/glas/seja` in `/api/glas/ukaz` najprej pokličeta omejevalnik hitrosti (Upstash).
- Lokalni naslov Upstash ne obstaja več (NXDOMAIN), zato vsak klic čaka 1 s na časovno omejitev in šele nato nadaljuje.
- Izmerjeno: `seja` brez prijave traja 1,02–1,18 s, `stanje` brez omejevalnika pa 0,01 s.
- To je del počasnega začetka, ki ga je Tim opazil, in doda ~1 s tudi vsakemu odgovoru. Velja lokalno.
- **Za produkcijo je treba preveriti, ali ima Vercel veljaven Upstash.** Če nima, ta zamuda velja za vse API-je aplikacije z omejevalnikom.

## Seznam ukazov za preizkus (10–15 min)

Na `/sl/glas-test`, z glasom:

1. »Kdo je naslednja?«
2. »Kdaj imam danes prosto?« in nato »pa jutri?«
3. »Kdo dela v soboto?«
4. »Ali ima [ime zaposlene] jutri kaj prostega?«
5. »Kateri resursi so jutri zasedeni?«
6. »Povej mi vse o [stranka].«
7. Zapis barve: »[stranka], barva 6.3 z 7.1, 30 gramov, oksidant 6 %, 35 minut«. Potrdite z »ja«, nato vprašajte: »Katero barvo je imela [stranka]?«
8. »Odpri kartico [stranka]« → Odpri. Na kartici mora biti razdelek »Zapiski«.
9. »Kdo ni bil več kot 3 mesece?«
10. »Kako dodam odsotnost?«, »Kako povabim sodelavca?«, »Kaj vse znaš?«
11. »Odpri koledar.«
12. »Koliko smo zaslužili ta mesec?« Asistent mora odgovoriti, da tega ne dela.
