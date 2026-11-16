# Asistent+ — stavki za preizkus razpoznave govora (STT)

Namen: izbrati ponudnika STT za slovenščino na **pravih posnetkih iz salona**, preden
asistent gre strankam. Skripta `scripts/glas-stt-primerjava.mjs` primerja ponudnike na
teh stavkih (WER, imena strank, odtenki barv, zakasnitev, strošek).

## Kako posneti

1. Posnemite vsak stavek posebej, tako kot bi ga rekli med delom (ne berite počasi).
   Najbolje s telefonom v salonu, z običajnim hrupom (sušilnik, glasba) pri polovici stavkov.
2. Shranite kot `posnetki/01.m4a`, `posnetki/02.m4a` … (številka = številka stavka).
   Podprto: `.m4a .mp4 .webm .ogg .wav .mp3`.
3. Če je mogoče, naj stavke posnameta vsaj dve osebi (moški in ženski glas, različno narečje):
   `posnetki-ana/01.m4a`, `posnetki-marko/01.m4a` … in skripto poženete za vsako mapo.
4. Imena strank v stavkih so izmišljena. Če želite preizkus na svojih strankah, jih zamenjajte
   tukaj (v vrstici `imena:`) **in** v datoteki z namigi — a te datoteke potem ne commitajte.

## Oblika vrstice

`NN | pričakovani prepis | imena: Ime Priimek; … | odtenki: 6.3, 7.1`

Pričakovani prepis je zapisan tako, kot bi ga želeli dobiti (številke s števkami).
Skripta pred primerjavo poenoti številke ("šest pika tri" = "6.3").

## Stavki

<!-- stavki:zacetek -->
01 | Kaj imam jutri? | imena: | odtenki:
02 | Kaj imamo danes na sporedu? | imena: | odtenki:
03 | Kdaj je bila Mateja Kovačič nazadnje pri nas? | imena: Mateja Kovačič | odtenki:
04 | Poišči stranko Špela Žagar. | imena: Špela Žagar | odtenki:
05 | Kdaj ima Nina Hribar naslednji termin? | imena: Nina Hribar | odtenki:
06 | Kdaj je prvi prosti termin za barvanje? | imena: | odtenki:
07 | Prvi prosti termin za moško striženje pri Tini. | imena: Tina | odtenki:
08 | Kaj ima Urška v petek? | imena: Urška | odtenki:
09 | Na kartico Mateje Kovačič zapiši barva 6.3 in 7.1, 30 gramov, oksidant 6 %, 35 minut. | imena: Mateja Kovačič | odtenki: 6.3, 7.1
10 | Za Ano Novak zapiši odtenek 8.1 z oksidantom 9 %, čakala je 40 minut. | imena: Ana Novak | odtenki: 8.1
11 | Dodaj zapisek za Petro Zupančič: barva 5.0 in 6.34, 60 gramov, 30 minut. | imena: Petra Zupančič | odtenki: 5.0, 6.34
12 | Pri Jerneji Vidmar smo dali 7.43, oksidant 3 %, 25 minut. | imena: Jerneja Vidmar | odtenki: 7.43
13 | Zapiši pri Katarini Golob, da je imela balayage s tonerjem 9.1. | imena: Katarina Golob | odtenki: 9.1
14 | Barva za Majo Krajnc: izrastek 4.0, konice 6.1, 45 minut. | imena: Maja Krajnc | odtenki: 4.0, 6.1
15 | Za Lucijo Turk zapiši 10.21 in 10.1, pol na pol, oksidant 6 procentov. | imena: Lucija Turk | odtenki: 10.21, 10.1
16 | Nevenka Pečnik ima rada hladne tone, zapiši kot preferenco. | imena: Nevenka Pečnik | odtenki:
17 | Zapiši pri Barbari Kos, da ne mara pretople barve. | imena: Barbara Kos | odtenki:
18 | Tadeja Mlakar ima občutljivo lasišče, dodaj opombo. | imena: Tadeja Mlakar | odtenki:
19 | Za Gregorja Kralja zapiši: striženje na dva milimetra ob straneh. | imena: Gregor Kralj | odtenki:
20 | Pri Alenki Bizjak zapiši, da želi vedno termin zjutraj. | imena: Alenka Bizjak | odtenki:
21 | Kdaj je bil Žiga Potočnik zadnjič tukaj? | imena: Žiga Potočnik | odtenki:
22 | Poišči Jožico Kastelic. | imena: Jožica Kastelic | odtenki:
23 | Kdaj pride Saša Erjavec? | imena: Saša Erjavec | odtenki:
24 | Ali ima Klavdija Šuštar kaj ta teden? | imena: Klavdija Šuštar | odtenki:
25 | Zapiši pri Vesni Jerman barvo 6.66 in 7.44, 40 gramov, 9 %, 35 minut. | imena: Vesna Jerman | odtenki: 6.66, 7.44
26 | Za Darjo Rozman: keratin, 90 minut, brez pranja dva dni. | imena: Darja Rozman | odtenki:
27 | Kaj imam pojutrišnjem? | imena: | odtenki:
28 | Kaj imam 18. 11.? | imena: | odtenki:
29 | Prvi prosti termin za trajno od ponedeljka. | imena: | odtenki:
30 | Kdaj je bila Monika Čuk nazadnje na pramenih? | imena: Monika Čuk | odtenki:
31 | Pri Ireni Ferjančič zapiši 5.1 na izrastek in 7.1 po dolžini, oksidant 6 %. | imena: Irena Ferjančič | odtenki: 5.1, 7.1
32 | Zapiši pri Teji Lešnik, da je alergična na amonijak. | imena: Teja Lešnik | odtenki:
33 | Kaj ima Mojca jutri popoldne? | imena: Mojca | odtenki:
34 | Za Tjašo Kocjančič barva 8.0 in 9.13, 50 gramov, 30 minut. | imena: Tjaša Kocjančič | odtenki: 8.0, 9.13
35 | Rok Zorko je bil zadovoljen s krajšo dolžino, zapiši kot preferenco. | imena: Rok Zorko | odtenki:
36 | Kdaj je bil zadnji obisk od Andreje Šinkovec? | imena: Andreja Šinkovec | odtenki:
37 | Na kartico Polone Jereb zapiši toner 9.12, 10 minut. | imena: Polona Jereb | odtenki: 9.12
38 | Poišči stranko Nuša Primožič. | imena: Nuša Primožič | odtenki:
39 | Zapiši pri Evi Ribič odtenek 6.3, gramaža 35, oksidant 6 %, 35 minut. | imena: Eva Ribič | odtenki: 6.3
40 | Kaj imamo v soboto dopoldne? | imena: | odtenki:
41 | Izbriši stranko Mateja Kovačič. | imena: Mateja Kovačič | odtenki:
42 | Pošlji vsem strankam sporočilo o akciji. | imena: | odtenki:
<!-- stavki:konec -->

Stavka 41 in 42 asistent **mora zavrniti** (brisanje in množična sporočila nista dovoljena);
v preizkusu STT sta, ker morata biti tudi razpoznana pravilno.

## Datoteka z namigi (neobvezno)

Za preizkus z namigi (keyterms/prompt) naredite `namigi.txt` z enim izrazom v vrstici:
imena strank iz stavkov zgoraj, imena zaposlenih (Tina, Urška, Mojca), storitve
(barvanje, moško striženje, pramenov, trajna, keratin) in izraze (oksidant, balayage, toner,
izrastek, konice). Skripta primerja vsakega ponudnika brez in z namigi.
