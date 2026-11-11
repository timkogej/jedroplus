# SMS vzorci (slovenščina): osnutek za pregled

Stanje: **osnutek, nič še ni v n8n.** Besedila so zapisana tako, kot bi jih stranka dobila (brez šumnikov, ker pošiljamo kot GSM-7 do 160 znakov). `[kdaj]` pomeni »danes«, »jutri«, »v petek« ali datum `13. 11.`, kot ga izračuna koda. `[P]` je ime podjetja na koncu. Povezavo (»Prestavitev: …«) doda koda za besedilom, zato je v vzorcih ni.

## Pravila, ki veljajo za vse vzorce

1. **Vikanje:** »vaš termin« se brez šumnikov zapiše »vas termin«. Na začetku stavka (»Vas termin je rezerviran«) to še pride, v sredini pa lahko izgleda kot napaka. Zato je »vas termin« dovoljen samo na začetku besedila ali stavka, drugje uporabljamo »termin je rezerviran«, »imate termin«, »ste pri nas«.
2. **Tikanje** uporablja »tvoj«, »imaš« (zapisano »imas«), »te«.
3. **Obvestilo o rezervaciji** pove samo: termin je rezerviran, kdaj, in morda za kaj. Ne piše »pričakujemo vas« ali »vse je pripravljeno«. Nikoli »potrjen«.
4. **Opomnik** pove: spomnimo vas, kdaj. Tu je »pričakujemo vas« na mestu.
5. **Zaključek je neobvezen.** Vsaj tretjina sporočil gre brez »Veselimo se«. Ko ga je, se ne ponavlja zaporedoma pri isti stranki.
6. **Ime:** samo ime (pri prijaznem in sproščenem tonu). Pri formalnem tonu »G. Priimek« oziroma »Ga. Priimek«, če sta spol in priimek znana.
7. **Dan:** 0 dni »danes«, 1 dan »jutri«, 2 do 6 dni dan v tednu (»v petek«), 7 ali več datum (`13. 11.`).
8. **Prepovedano:** »Sporočamo vam«, »Računamo na vas«, »Čas vašega termina se približuje«, »Termin vas že čaka«, »Vse je pripravljeno za vaš obisk«, »Ne pozabite« (opomin).

---

## A. Obvestilo o rezervaciji (potrdilo): popravljeno po tvojih komentarjih

### Vikanje
| # | Vzorec | Primer |
|---|---|---|
| P1 | `[Ime], vas termin je rezerviran: [kdaj]. [zaklj.] [P]` | Maja, vas termin je rezerviran: jutri ob 9:00. Se vidimo! Salon Ana |
| P2 | `Pozdravljeni, [Ime]! Rezervirali smo vam termin za [storitev]: [kdaj]. [P]` | Pozdravljeni, Maja! Rezervirali smo vam termin za strizenje: v petek ob 9:00. Salon Ana |
| P3 | `Hvala za rezervacijo, [Ime]! Termin: [kdaj]. [zaklj.] [P]` (ostane) | Hvala za rezervacijo, Maja! Termin: jutri ob 9:00. Vidimo se! Salon Ana |
| P4 | `[Ime], zabelezili smo vam termin [kdaj]. Hvala za zaupanje! [P]` | Maja, zabelezili smo vam termin v petek ob 9:00. Hvala za zaupanje! Salon Ana |
| P5 (novo) | `[Ime], vpisali smo vam termin: [kdaj]. [zaklj.] [P]` | Maja, vpisali smo vam termin: jutri ob 9:00. Lep dan! Salon Ana |
| P6 (novo) | `Pozdravljeni, [Ime]! Vas termin za [storitev] je rezerviran: [kdaj]. [P]` | Pozdravljeni, Maja! Vas termin za strizenje je rezerviran: jutri ob 9:00. Salon Ana |

Odstranjena: stari P4 (»termin pri nas imate«) in stari P6 (»rezervacija je urejena«).

### Tikanje
| # | Vzorec | Primer |
|---|---|---|
| P1 | `[Ime], tvoj termin je rezerviran: [kdaj]. [zaklj.] [P]` (ostane) | Maja, tvoj termin je rezerviran: jutri ob 18:00. Vidimo se! Fit Studio |
| P2 | `Hej [Ime]! Rezervirali smo te za [storitev]: [kdaj]. [P]` (ostane) | Hej Maja! Rezervirali smo te za trening: v petek ob 18:00. Fit Studio |
| P3 | `Hvala za rezervacijo, [Ime]! Termin: [kdaj]. [zaklj.] [P]` (ostane) | Hvala za rezervacijo, Maja! Termin: jutri ob 18:00. Vidimo se! Fit Studio |
| P4 (nov) | `[Ime], zabelezili smo ti termin [kdaj]. Hvala za zaupanje! [P]` | Maja, zabelezili smo ti termin v petek ob 18:00. Hvala za zaupanje! Fit Studio |
| P5 (nov) | `Super, [Ime]! Tvoj termin je rezerviran: [kdaj]. [zaklj.] [P]` | Super, Maja! Tvoj termin je rezerviran: jutri ob 18:00. Se vidimo! Fit Studio |
| P6 (nov) | `[Ime], vpisali smo ti termin: [kdaj]. [zaklj.] [P]` | Maja, vpisali smo ti termin: jutri ob 18:00. Lep dan! Fit Studio |

Odstranjena: stari P4 (»termin imas«), stari P5 (»zapisali smo te«), stari P6 (»rezervirano je«).

### Veterina (samo panoge z živalmi)
V aplikaciji ni polja za ime živali, zato AI imena **nikoli ne ugiba**. Vedno splošno, kar je vedno pravilno:

| | Vzorec | Primer |
|---|---|---|
| Vikanje | `[Ime], termin za vasega ljubljencka je rezerviran: [kdaj]. [zaklj.] [P]` | Maja, termin za vasega ljubljencka je rezerviran: jutri ob 9:00. Se vidimo! Vet Novak |
| Vikanje (2) | `[Ime], rezervirali smo vam termin za vasega ljubljencka: [kdaj]. [P]` | Maja, rezervirali smo vam termin za vasega ljubljencka: v petek ob 9:00. Vet Novak |
| Tikanje | `[Ime], termin za tvojega ljubljencka je rezerviran: [kdaj]. [zaklj.] [P]` | Maja, termin za tvojega ljubljencka je rezerviran: jutri ob 9:00. Vidimo se! Vet Novak |

(Če je v opombah termina izrecno ime živali, ga AI lahko uporabi; sicer ne.)

### Storitve na domu (samo originalni vzorec)
| Nagovor | Vzorec | Primer |
|---|---|---|
| vikanje | `[Ime], [kdaj] pridemo k vam[ za storitev]. [zaklj.] [P]` | Maja, v petek ob 9:00 pridemo k vam za pregled dimnika. Se vidimo! Dimnikarstvo Kovac |
| tikanje | `[Ime], [kdaj] pridemo k tebi[ za storitev]. [zaklj.] [P]` | Maja, jutri ob 9:00 pridemo k tebi. Se vidimo! Servis Kovac |

---|---|---|---|
| H1 | vikanje | `[Ime], [kdaj] pridemo k vam[ za storitev]. [zaklj.] [P]` | Maja, v petek ob 9:00 pridemo k vam za pregled dimnika. Se vidimo! Dimnikarstvo Kovac |
| H2 | vikanje | `[Ime], vas termin doma je rezerviran: [kdaj]. [zaklj.] [P]` | Maja, vas termin doma je rezerviran: jutri ob 9:00. Se vidimo! Vodoservis Novak |
| H3 | vikanje | `Pozdravljeni, [Ime]! Rezervirali smo vam obisk na domu: [kdaj]. [P]` | Pozdravljeni, Maja! Rezervirali smo vam obisk na domu: v petek ob 9:00. Vodoservis Novak |
| H1 | tikanje | `[Ime], [kdaj] pridemo k tebi[ za storitev]. [zaklj.] [P]` | Maja, jutri ob 9:00 pridemo k tebi. Se vidimo! Servis Kovac |
| H2 | tikanje | `[Ime], tvoj termin doma je rezerviran: [kdaj]. [zaklj.] [P]` | Maja, tvoj termin doma je rezerviran: jutri ob 9:00. Vidimo se! Servis Kovac |
| H3 | tikanje | `Hej [Ime]! Rezervirali smo ti obisk na domu: [kdaj]. [P]` | Hej Maja! Rezervirali smo ti obisk na domu: v petek ob 9:00. Servis Kovac |

---

## B. Opomnik pred terminom: popravljeno po tvojih komentarjih

### Vikanje
| # | Vzorec | Primer |
|---|---|---|
| P1 (novo) | `[Ime], [kdaj] ob [cas] imate pri nas termin. [zaklj.] [P]` | Maja, jutri ob 9:00 imate pri nas termin. Se vidimo! Salon Ana |
| P2 (novo) | `[Ime], kmalu se vidimo: [kdaj] ob [cas]. [zaklj.] [P]` | Maja, kmalu se vidimo: jutri ob 9:00. Lep dan! Salon Ana |
| P3 | `Pozdravljeni, [Ime]! Prijazen opomnik: termin imate [kdaj] ob [cas]. [P]` (ostane) | Pozdravljeni, Maja! Prijazen opomnik: termin imate v petek ob 9:00. Salon Ana |
| P4 | `[Ime], vidimo se [kdaj] ob [cas]! [zaklj.] [P]` (ostane) | Maja, vidimo se jutri ob 9:00! Lep dan! Salon Ana |
| P5 (novo) | `[Ime], [kdaj] ob [cas] imate termin za [storitev]. [zaklj.] [P]` | Maja, jutri ob 9:00 imate termin za strizenje. Se vidimo! Salon Ana |
| P6 | `[Ime], le kratek opomnik: [kdaj] ob [cas] imate termin. [P]` (ostane) | Maja, le kratek opomnik: v petek ob 9:00 imate termin. Salon Ana |
| VET | `[Ime], [kdaj] ob [cas] pricakujemo [vasega ljubljencka]. [zaklj.] [P]` (ostane) | Maja, jutri ob 9:00 pricakujemo vasega ljubljencka. Se vidimo! Vet Novak |
| HOME | `[Ime], [kdaj] ob [cas] pridemo k vam[ za storitev]. [P]` (ostane) | Maja, jutri ob 9:00 pridemo k vam za pregled dimnika. Dimnikarstvo Kovac |

### Tikanje
| # | Vzorec | Primer |
|---|---|---|
| P1 (novo) | `[Ime], [kdaj] ob [cas] imas pri nas termin. [zaklj.] [P]` | Maja, jutri ob 18:00 imas pri nas termin. Se vidimo! Fit Studio |
| P2 | `[Ime], [kdaj] ob [cas] te pricakujemo. [zaklj.] [P]` (ostane) | Maja, jutri ob 18:00 te pricakujemo. Dobrodosla! Fit Studio |
| P3 (novo) | `[Ime], veselimo se te [kdaj] ob [cas]! [P]` | Maja, veselimo se te jutri ob 18:00! Fit Studio |
| P4 | `[Ime], vidimo se [kdaj] ob [cas]! [zaklj.] [P]` (ostane) | Maja, vidimo se jutri ob 18:00! Lep dan! Fit Studio |
| P5 (novo) | `[Ime], [kdaj] ob [cas] imas termin za [storitev]. [zaklj.] [P]` | Maja, jutri ob 18:00 imas termin za trening. Se vidimo! Fit Studio |
| VET | `[Ime], [kdaj] ob [cas] pricakujemo tvojega ljubljencka. [zaklj.] [P]` | Maja, jutri ob 9:00 pricakujemo tvojega ljubljencka. Se vidimo! Vet Novak |
| HOME | `[Ime], [kdaj] ob [cas] pridemo k tebi[ za storitev]. [P]` | Maja, jutri ob 9:00 pridemo k tebi za pregled. Servis Kovac |

---

## Zaključki (neobvezni, menjajo se)

- Vikanje: Se vidimo · Vidimo se · Lep dan · Lep dan zelimo · Dobrodosli · Veselimo se · Z veseljem vas pricakujemo (samo v opomniku)
- Tikanje: Se vidimo · Vidimo se · Lep dan · Dobrodosel/Dobrodosla · Veselimo se
- Brez zaključka: vsaj vsako tretje sporočilo.

## Kar mora kodno preverjanje ujeti

- Besede iz točke 8 (prepovedane fraze).
- Vikanje: v besedilu ni »tvoj«, »te«, »imas«, »si«. Tikanje: ni »vas«, »vam«, »ste«, »imate«.
- Potrdilo: ni »pricakujemo«, »pripravljeno«, »opomnik«.
- Opomnik: ni »rezerviran«, »zabelezili«.

## Odločitve za tebe

1. Ali ti pasejo ti vzorci in zaključki? Označi, kaj črtamo ali popravimo.
2. Pri formalnem tonu: »G. Novak, termin je rezerviran: …« (ime z naslovom), ali ostane samo ime?
3. Ali dodamo še nekaj bolj sproščenih vzorcev za ton »sproščen« (npr. »Hej Maja, vidimo se jutri ob 9:00!«)?
