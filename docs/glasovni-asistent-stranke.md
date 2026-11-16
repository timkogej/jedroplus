# Asistent+ — fokus, vse o stranki, urejanje termina in stranke

13. 11. 2026, veja `cx/glasovni-asistent-osnova`. Nič ni pushano.

## Kaj asistent zdaj zna (primeri)

- **Ve, o kom govorimo.** Na primer: »Kaj vemo o Timu Zupančiču?« → (dotik na pravega Tima) → »Kakšen telefon ima?« → »Prestavi mu termin na petek.« Asistent ne vpraša znova, za katerega Tima gre.
- **Novo ime zamenja fokus.** Na primer: »Zapiši termin za Anjo« → »Ne, za Ano Novak.«
- **Vse o stranki.** Primeri:
  - »Kakšen telefon ima?« → »nič štiri ena, dve tri štiri, pet šest sedem« in gumb **Pokliči**;
  - »Kakšen mail ima Mateja?« → »mateja pika k afna gmail pika com« in gumb **Piši**;
  - »Ima Ana kakšno opombo?«;
  - »V katerem jeziku ji pišemo?«;
  - »Ali sme dobiti novice?« (privolitev null pomeni ne);
  - »Kolikokrat je že bila?« (obiski in neprihodi);
  - »Kdaj pride naslednjič?«.
- **Urejanje termina** (`uredi_termin`, obrazec termina, »Shranim?«):
  - »Spremeni jezik termina v angleščino.«
  - »Dodaj še barvanje.«
  - »Daj ga k Maji.«
  - »V opombo napiši, da bo zamujala.«
  - »Prestavi v Šiško.«
  - »Prestavi na petek ob desetih.«
- **Nov termin z več podatki.** Na primer: »Vpiši Ano jutri ob desetih na striženje in še barvanje, v angleščini, opomba prvič pri nas.« Brez navedenega jezika ostane privzeti jezik obrazca.
- **Urejanje stranke** (`uredi_stranko`, obrazec stranke, »Shranim?«):
  - »Ani spremeni telefon na 041 999 888.«
  - »Piši ji v nemščini.«
  - »V opombe stranke dodaj …«
  - Marketinške privolitve asistent ne spreminja, samo pove, kakšna je.
- **»Isto kot zadnjič«.** Na primer: »Zapiši Matejo isto kot zadnjič čez šest tednov.« Storitev in zaposleni pridejo iz zadnjega termina. Lokacija pride iz zadnjega termina, če zaposleni tam še dela.
- **»Pokliči jo«** pokaže gumb Pokliči za aktivno stranko. Klic se nikoli ne začne sam.
- **»Ponovi«, »kaj si rekla«, »počasneje«.** Obdela jih brskalnik, brez strežnika in AI. »Počasneje« zniža hitrost glasu, in nižja hitrost velja do konca pogovora.
- **Sklanjanje imen zaposlenih:** »pri Luki«, »pri Tini«, »pri Marku«.

## Zasebnost

- Telefon, e-pošta in opombe gredo samo na zaslon in v glas.
- Modelu AI gre namesto njih oznaka, na primer »(telefon prikazan)«. Ista oznaka gre v `glas_ukazi.odgovor` in v zgodovino pogovora.
- Narekovana številka ali e-naslov gre v `glas_ukazi.prepis` kot »(telefon)« ali »(e-pošta)«.
- Model dobi narekovani podatek samo v trenutni izjavi, ker ga mora podati orodju.
- Fokus v bazi hrani samo ID-je (`stranka_id`, `termin_id`, `termin_datum`).
  - Fokus se prebere samo za istega uporabnika in podjetje, zadnjih 5 minut.
  - Stranka in termin se vedno znova prebereta z uporabnikovo sejo (RLS). Tuj ID izpade.
- Gumba Pokliči in Piši sprejmeta samo `tel:` in `mailto:` brez parametrov.

## Migracija (NI zagnana)

Datoteka je `supabase/migrations/1793600000_glas_kontekst.sql`. Naredi dve stvari:

- doda stolpec `glas_ukazi.kontekst jsonb`;
- na novo ustvari `jp_glas_zakljuci_ukaz`, ki zapiše tudi `kontekst`.

Migracija je idempotentna. Preizkušena je v začasnem Postgresu (`bash tests/glas/sql/zazeni.sh`).

Zagon: Supabase → SQL Editor → prilepi celotno datoteko → Run.

Do zagona vse deluje naprej, samo brez fokusa med izjavami: koda ob manjkajočem stolpcu bere zgodovino brez njega.

## Preverjanje

- `npx vitest run`: 298 testov uspešnih, 1 preskočen (eval).
  - Novi testi: `fokus`, `podatki-stranke`, `uredi-termin`, `uredi-stranko`, `kot-zadnjic`, ponovi/počasneje v `pogovor-tok` in `tok`.
- `npx tsc --noEmit` je čist.
- `eslint` (glas, koledar, obrazci): brez novih opozoril.
- `npx next build` v ločeni kopiji uspe.
- **Eval s pravim modelom** (Haiku), 18 pogovorov, 5 med njimi novih.
  - Po popravkih: 18/18, 18/18, 18/18. Pred popravki: 16/18, 17/18, 16/18.
  - Robotskih odgovorov ni bilo.
  - Mediana LLM je 1,9 s (1,2–3,6 s); ta čas vključuje tudi dvokrožne ukaze.
- Nestabilen star primer: »Pedikura za Luka … ob 10 zjutraj« → »Ne danes. Za ponedeljek.« Model je enkrat vprašal »Kateri ponedeljek?«.
- »Prestavi Matejo« → »na ponedeljek« → »ob dvanajstih«: v vseh zagonih OK.
  - Prestavitev zdaj najprej najde termin in vpraša »Na kdaj?«.
  - Najdeni termin postane aktiven.

## Nepreizkušeno (brskalnik s prijavo, iPhone)

Brskalnik na računalniku (localhost:3002, s prijavo):

1. »Kdaj pride Ana?« → »Spremeni jezik termina v angleščino.« Odpre se obrazec termina v urejanju z jezikom ENG. »ja« ga shrani, asistent reče »Super, termin je posodobljen.«
2. Pri odprtem urejanju termina »Dodaj še barvanje.« Pojavi se druga storitev, konec termina se podaljša, prvotna storitev ostane.
3. »Daj ga k Urški.« Zaposleni se zamenja. Če Urška storitve ne opravlja, se storitev počisti (isto pravilo kot ročno).
4. »V opombo napiši, da bo zamujala.« Besedilo se doda obstoječi opombi in je ne zamenja. Isto preveri za interno opombo.
5. Podjetje z več lokacijami: »Prestavi v Šiško.« Lokacija se zamenja. Zaposleni ali storitev, ki ju tam ni, se počistita.
6. Nov termin: »Vpiši Matejo jutri ob enajstih na striženje in še barvanje, v angleščini.« Vidni morajo biti dve storitvi in jezik ENG.
7. »Kakšen telefon ima Mateja?« Številka je na zaslonu in izgovorjena po števkah, pod njo je gumb Pokliči. Gumb odpre klicanje, nič se ne pokliče samo. Isto preveri za e-pošto in gumb Piši.
8. »Ani spremeni telefon na …« Odpre se obrazec stranke v urejanju z novo številko. »ja« ga shrani.
9. »Ali sme dobiti novice?« Asistent samo pove, nič se ne odpre.
10. »Spremeni ji privolitev.« Asistent mora reči, da tega ne more.
11. »Ponovi.« in »Počasneje.« Ponovi se zadnji odgovor, po »počasneje« opazno počasneje.
12. Ročno odpri nov termin, urejanje termina in urejanje stranke. Vse mora delovati kot prej (brez asistenta, brez predizpolnitve).
13. Zaposleni s pravico »samo svoji termini« ne more urejati tujega termina ali ga dodeliti drugemu.

iPhone (Safari in PWA):

14. Gumb Pokliči odpre klicanje.
15. Gumb Piši odpre pošto.
16. Hitrost glasu po »počasneje«.
17. Obrazec stranke v urejanju odprt z glasom (list od spodaj, krogec v kotu obrazca).
