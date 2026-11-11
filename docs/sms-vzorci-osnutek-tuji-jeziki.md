# SMS vzorci: hrvaščina, angleščina, nemščina, italijanščina (osnutek)

Stanje: **osnutek, nič še ni v n8n.** Struktura je enaka kot pri slovenščini: 6 vzorcev za potrdilo in 5 do 6 za opomnik, ločeno za formalni (vikanje, Sie, Lei) in neformalni nagovor (tikanje, du, tu). Besedila so zapisana brez šumnikov in naglasov (GSM-7, do 160 znakov). `[kdaj]` pomeni dan ali datum, ki ga izračuna koda. Povezavo za prestavitev doda koda na konec. `[P]` je ime podjetja.

## Skupna pravila

1. **Zaključek je neobvezen**, vsaj vsako tretje sporočilo ga nima.
2. **Obvestilo o rezervaciji** pove samo, da je termin rezerviran in kdaj. Opomnik pove, kdaj se vidimo. Ne mešamo.
3. **Prepovedano v vseh jezikih:** izražanje »računamo na vas« (HR racunamo na vas, EN counting on you, DE wir rechnen mit Ihnen, IT contiamo su di Lei).
4. **Ime:** samo ime (prijazen in sproščen ton). Formalni ton: naziv + priimek, če sta spol in priimek znana.
5. **Ime storitve** AI sklanja samo, če je prepričan. Sicer storitev izpusti (to je že v prompt za HR in IT).

---

## HRVAŠČINA

Posebnost: **vokativ imena** (Ivan → Ivane, Marko → Marko, Ana → Ana). Če AI ni prepričan o vokativu, ime izpusti in napiše »Dobar dan,« ali »Bok!«. Pozor: »vaš« se brez šumnikov zapiše »vas«, zato »vas termin« samo na začetku stavka.

### Potrdilo: formalno (Vi)
| # | Vzorec | Primer |
|---|---|---|
| P1 | `[Ime], vas termin je rezerviran: [kdaj]. [zaklj.] [P]` | Maja, vas termin je rezerviran: sutra u 9:00. Vidimo se! Salon Ana |
| P2 | `Dobar dan, [Ime]! Rezervirali smo vam termin za [uslugu]: [kdaj]. [P]` | Dobar dan, Maja! Rezervirali smo vam termin za sisanje: u petak u 9:00. Salon Ana |
| P3 | `Hvala na rezervaciji, [Ime]! Termin: [kdaj]. [zaklj.] [P]` | Hvala na rezervaciji, Maja! Termin: sutra u 9:00. Vidimo se! Salon Ana |
| P4 | `[Ime], zabiljezili smo vam termin [kdaj]. Hvala na povjerenju! [P]` | Maja, zabiljezili smo vam termin u petak u 9:00. Hvala na povjerenju! Salon Ana |
| P5 | `[Ime], upisali smo vam termin: [kdaj]. [zaklj.] [P]` | Maja, upisali smo vam termin: sutra u 9:00. Lijep dan! Salon Ana |
| P6 | `Dobar dan, [Ime]! Vas termin za [uslugu] je rezerviran: [kdaj]. [P]` | Dobar dan, Maja! Vas termin za sisanje je rezerviran: sutra u 9:00. Salon Ana |

### Potrdilo: neformalno (ti)
| # | Vzorec | Primer |
|---|---|---|
| T1 | `[Ime], tvoj termin je rezerviran: [kdaj]. [zaklj.] [P]` | Maja, tvoj termin je rezerviran: sutra u 18:00. Vidimo se! Fit Studio |
| T2 | `Bok [Ime]! Rezervirali smo ti termin za [uslugu]: [kdaj]. [P]` | Bok Maja! Rezervirali smo ti termin za trening: u petak u 18:00. Fit Studio |
| T3 | `Hvala na rezervaciji, [Ime]! Termin: [kdaj]. [zaklj.] [P]` | Hvala na rezervaciji, Maja! Termin: sutra u 18:00. Vidimo se! Fit Studio |
| T4 | `[Ime], zabiljezili smo ti termin [kdaj]. Hvala na povjerenju! [P]` | Maja, zabiljezili smo ti termin u petak u 18:00. Hvala na povjerenju! Fit Studio |
| T5 | `Super, [Ime]! Tvoj termin je rezerviran: [kdaj]. [zaklj.] [P]` | Super, Maja! Tvoj termin je rezerviran: sutra u 18:00. Vidimo se! Fit Studio |
| T6 | `[Ime], upisali smo ti termin: [kdaj]. [zaklj.] [P]` | Maja, upisali smo ti termin: sutra u 18:00. Lijep dan! Fit Studio |

Veterina: `[Ime], termin za vaseg/tvog ljubimca je rezerviran: [kdaj].` Dom: `[Ime], [kdaj] dolazimo k vama/tebi[ za uslugu].`

### Opomnik: formalno (Vi)
| # | Vzorec | Primer |
|---|---|---|
| P1 | `[Ime], [kdaj] u [vrijeme] imate kod nas termin. [zaklj.] [P]` | Maja, sutra u 9:00 imate kod nas termin. Vidimo se! Salon Ana |
| P2 | `[Ime], uskoro se vidimo: [kdaj] u [vrijeme]. [zaklj.] [P]` | Maja, uskoro se vidimo: sutra u 9:00. Lijep dan! Salon Ana |
| P3 | `Dobar dan, [Ime]! Ljubazan podsjetnik: termin imate [kdaj] u [vrijeme]. [P]` | Dobar dan, Maja! Ljubazan podsjetnik: termin imate u petak u 9:00. Salon Ana |
| P4 | `[Ime], vidimo se [kdaj] u [vrijeme]! [zaklj.] [P]` | Maja, vidimo se sutra u 9:00! Lijep dan! Salon Ana |
| P5 | `[Ime], [kdaj] u [vrijeme] imate termin za [uslugu]. [zaklj.] [P]` | Maja, sutra u 9:00 imate termin za sisanje. Vidimo se! Salon Ana |
| P6 | `[Ime], samo kratki podsjetnik: [kdaj] u [vrijeme] imate termin. [P]` | Maja, samo kratki podsjetnik: u petak u 9:00 imate termin. Salon Ana |

### Opomnik: neformalno (ti)
| # | Vzorec | Primer |
|---|---|---|
| T1 | `[Ime], [kdaj] u [vrijeme] imas kod nas termin. [zaklj.] [P]` | Maja, sutra u 18:00 imas kod nas termin. Vidimo se! Fit Studio |
| T2 | `[Ime], [kdaj] u [vrijeme] te ocekujemo. [zaklj.] [P]` | Maja, sutra u 18:00 te ocekujemo. Dobrodosla! Fit Studio |
| T3 | `[Ime], veselimo se te [kdaj] u [vrijeme]! [P]` | Maja, veselimo se te sutra u 18:00! Fit Studio |
| T4 | `[Ime], vidimo se [kdaj] u [vrijeme]! [zaklj.] [P]` | Maja, vidimo se sutra u 18:00! Lijep dan! Fit Studio |
| T5 | `[Ime], [kdaj] u [vrijeme] imas termin za [uslugu]. [zaklj.] [P]` | Maja, sutra u 18:00 imas termin za trening. Vidimo se! Fit Studio |

Zaključki: Vidimo se · Lijep dan · Dobrodosli/Dobrodosla · Veselimo se · (neformalno) Jedva cekamo. **»Jedva cekamo« samo v hrvaščini.**
Čas: sutra / u petak / 13. 11. · `u 9:00`.

---

## ANGLEŠČINA

Nagovor je enak za vse, razlikuje se samo ton: prijazen (ime), formalen (»Ms. Novak«). Čas: `9 AM`, `2:30 PM`.

### Potrdilo
| # | Vzorec | Primer |
|---|---|---|
| P1 | `[Name], your appointment is booked: [when]. [closing] [P]` | Maja, your appointment is booked: tomorrow at 9 AM. See you! Salon Ana |
| P2 | `Hi [Name]! We've booked you in for [service]: [when]. [P]` | Hi Maja! We've booked you in for a haircut: Friday at 9 AM. Salon Ana |
| P3 | `Thanks for booking, [Name]! Appointment: [when]. [closing] [P]` | Thanks for booking, Maja! Appointment: tomorrow at 9 AM. See you soon! Salon Ana |
| P4 | `[Name], we've noted your appointment [when]. Thanks for choosing us! [P]` | Maja, we've noted your appointment on Friday at 9 AM. Thanks for choosing us! Salon Ana |
| P5 | `[Name], you're all booked: [when]. [closing] [P]` | Maja, you're all booked: tomorrow at 9 AM. Have a great day! Salon Ana |
| P6 | `Hi [Name]! Your [service] appointment is booked: [when]. [P]` | Hi Maja! Your haircut appointment is booked: tomorrow at 9 AM. Salon Ana |

Veterina: `[Name], your pet's appointment is booked: [when].` Dom: `[Name], we'll come to you [when][ for service].`

### Opomnik
| # | Vzorec | Primer |
|---|---|---|
| P1 | `[Name], you have an appointment with us [when] at [time]. [closing] [P]` | Maja, you have an appointment with us tomorrow at 9 AM. See you! Salon Ana |
| P2 | `Looking forward to seeing you [when] at [time], [Name]! [P]` | Looking forward to seeing you tomorrow at 9 AM, Maja! Salon Ana |
| P3 | `Hi [Name]! Friendly reminder: your appointment is [when] at [time]. [P]` | Hi Maja! Friendly reminder: your appointment is on Friday at 9 AM. Salon Ana |
| P4 | `[Name], see you [when] at [time]! [closing] [P]` | Maja, see you tomorrow at 9 AM! Have a great day! Salon Ana |
| P5 | `[Name], you're booked for [service] [when] at [time]. [closing] [P]` | Maja, you're booked for a haircut tomorrow at 9 AM. See you soon! Salon Ana |
| P6 | `[Name], just a quick reminder: your appointment is [when] at [time]. [P]` | Maja, just a quick reminder: your appointment is on Friday at 9 AM. Salon Ana |

Zaključki: See you · See you soon · Have a great day · Welcome. Prepovedano: »we're counting on you«, »we're delighted to expect you«, »your appointment awaits«, »appointment time is near«, »Just letting you know«.

---

## NEMŠČINA

Umlauti: ae, oe, ue, ss (Muenchen, fuer). Čas: `um 9 Uhr`, `um 9:30 Uhr`. kdaj: heute / morgen / am Freitag / 13.11.

### Potrdilo: formalno (Sie)
| # | Vzorec | Primer |
|---|---|---|
| P1 | `[Name], Ihr Termin ist gebucht: [kdaj]. [Closing] [P]` | Maja, Ihr Termin ist gebucht: morgen um 9 Uhr. Bis bald! Salon Ana |
| P2 | `Guten Tag, [Name]! Wir haben Ihnen einen Termin fuer [Leistung] reserviert: [kdaj]. [P]` | Guten Tag, Maja! Wir haben Ihnen einen Termin fuer einen Haarschnitt reserviert: am Freitag um 9 Uhr. Salon Ana |
| P3 | `Danke fuer Ihre Buchung, [Name]! Termin: [kdaj]. [Closing] [P]` | Danke fuer Ihre Buchung, Maja! Termin: morgen um 9 Uhr. Bis bald! Salon Ana |
| P4 | `[Name], wir haben Ihren Termin notiert: [kdaj]. Danke fuer Ihr Vertrauen! [P]` | Maja, wir haben Ihren Termin notiert: am Freitag um 9 Uhr. Danke fuer Ihr Vertrauen! Salon Ana |
| P5 | `[Name], Ihr Termin steht: [kdaj]. [Closing] [P]` | Maja, Ihr Termin steht: morgen um 9 Uhr. Schoenen Tag! Salon Ana |
| P6 | `Guten Tag, [Name]! Ihr Termin fuer [Leistung] ist gebucht: [kdaj]. [P]` | Guten Tag, Maja! Ihr Termin fuer einen Haarschnitt ist gebucht: morgen um 9 Uhr. Salon Ana |

### Potrdilo: neformalno (du)
| # | Vzorec | Primer |
|---|---|---|
| T1 | `[Name], dein Termin ist gebucht: [kdaj]. [Closing] [P]` | Maja, dein Termin ist gebucht: morgen um 18 Uhr. Bis bald! Fit Studio |
| T2 | `Hallo [Name]! Wir haben dir einen Termin fuer [Leistung] reserviert: [kdaj]. [P]` | Hallo Maja! Wir haben dir einen Termin fuer ein Training reserviert: am Freitag um 18 Uhr. Fit Studio |
| T3 | `Danke fuer deine Buchung, [Name]! Termin: [kdaj]. [Closing] [P]` | Danke fuer deine Buchung, Maja! Termin: morgen um 18 Uhr. Bis bald! Fit Studio |
| T4 | `[Name], wir haben deinen Termin notiert: [kdaj]. Danke fuer dein Vertrauen! [P]` | Maja, wir haben deinen Termin notiert: am Freitag um 18 Uhr. Danke fuer dein Vertrauen! Fit Studio |
| T5 | `Super, [Name]! Dein Termin steht: [kdaj]. [Closing] [P]` | Super, Maja! Dein Termin steht: morgen um 18 Uhr. Bis bald! Fit Studio |
| T6 | `[Name], dein Termin ist eingetragen: [kdaj]. [Closing] [P]` | Maja, dein Termin ist eingetragen: morgen um 18 Uhr. Schoenen Tag! Fit Studio |

### Opomnik: formalno (Sie)
| # | Vzorec | Primer |
|---|---|---|
| P1 | `[Name], Sie haben [kdaj] um [Zeit] einen Termin bei uns. [Closing] [P]` | Maja, Sie haben morgen um 9 Uhr einen Termin bei uns. Bis bald! Salon Ana |
| P2 | `[Name], bis bald: [kdaj] um [Zeit]. [Closing] [P]` | Maja, bis bald: morgen um 9 Uhr. Schoenen Tag! Salon Ana |
| P3 | `Guten Tag, [Name]! Freundliche Erinnerung: Ihr Termin ist [kdaj] um [Zeit]. [P]` | Guten Tag, Maja! Freundliche Erinnerung: Ihr Termin ist am Freitag um 9 Uhr. Salon Ana |
| P4 | `[Name], wir sehen uns [kdaj] um [Zeit]! [Closing] [P]` | Maja, wir sehen uns morgen um 9 Uhr! Schoenen Tag! Salon Ana |
| P5 | `[Name], [kdaj] um [Zeit] haben Sie einen Termin fuer [Leistung]. [Closing] [P]` | Maja, morgen um 9 Uhr haben Sie einen Termin fuer einen Haarschnitt. Bis bald! Salon Ana |
| P6 | `[Name], nur eine kurze Erinnerung: [kdaj] um [Zeit] haben Sie einen Termin. [P]` | Maja, nur eine kurze Erinnerung: am Freitag um 9 Uhr haben Sie einen Termin. Salon Ana |

### Opomnik: neformalno (du)
| # | Vzorec | Primer |
|---|---|---|
| T1 | `[Name], du hast [kdaj] um [Zeit] einen Termin bei uns. [Closing] [P]` | Maja, du hast morgen um 18 Uhr einen Termin bei uns. Bis bald! Fit Studio |
| T2 | `[Name], bis bald: [kdaj] um [Zeit]. [Closing] [P]` | Maja, bis bald: morgen um 18 Uhr. Schoenen Tag! Fit Studio |
| T3 | `[Name], wir freuen uns auf dich [kdaj] um [Zeit]! [P]` | Maja, wir freuen uns auf dich morgen um 18 Uhr! Fit Studio |
| T4 | `[Name], wir sehen uns [kdaj] um [Zeit]! [Closing] [P]` | Maja, wir sehen uns morgen um 18 Uhr! Schoenen Tag! Fit Studio |
| T5 | `[Name], [kdaj] um [Zeit] hast du einen Termin fuer [Leistung]. [Closing] [P]` | Maja, morgen um 18 Uhr hast du einen Termin fuer ein Training. Bis bald! Fit Studio |

Zaključki: Bis bald · Wir sehen uns · Schoenen Tag · Willkommen. Prepovedano: »Wir moechten Sie informieren«, »wir erwarten Sie mit Freude«, »Ihr Termin wartet bereits«, »wir rechnen mit Ihnen«.

---

## ITALIJANŠČINA

Brez naglasov: »e« je lahko »è« ali »e«, zato vzorci izogibajo glagolu »è« (namesto »il Suo appuntamento è prenotato« uporabljajo »abbiamo prenotato il Suo appuntamento«). Formalno z veliko začetnico (Suo, Le). kdaj: oggi / domani / venerdi / 13/11. Čas: `alle 9:00`.

### Potrdilo: formalno (Lei)
| # | Vzorec | Primer |
|---|---|---|
| P1 | `[Nome], abbiamo prenotato il Suo appuntamento: [kdaj]. [Closing] [P]` | Maja, abbiamo prenotato il Suo appuntamento: domani alle 9:00. A presto! Salon Ana |
| P2 | `Buongiorno [Nome]! Le abbiamo riservato un appuntamento per [servizio]: [kdaj]. [P]` | Buongiorno Maja! Le abbiamo riservato un appuntamento per un taglio: venerdi alle 9:00. Salon Ana |
| P3 | `Grazie per la prenotazione, [Nome]! Appuntamento: [kdaj]. [Closing] [P]` | Grazie per la prenotazione, Maja! Appuntamento: domani alle 9:00. A presto! Salon Ana |
| P4 | `[Nome], abbiamo registrato il Suo appuntamento [kdaj]. Grazie per la fiducia! [P]` | Maja, abbiamo registrato il Suo appuntamento venerdi alle 9:00. Grazie per la fiducia! Salon Ana |
| P5 | `[Nome], Le abbiamo fissato un appuntamento: [kdaj]. [Closing] [P]` | Maja, Le abbiamo fissato un appuntamento: domani alle 9:00. Buona giornata! Salon Ana |
| P6 | `Buongiorno [Nome], appuntamento per [servizio] prenotato: [kdaj]. [P]` | Buongiorno Maja, appuntamento per un taglio prenotato: domani alle 9:00. Salon Ana |

### Potrdilo: neformalno (tu)
| # | Vzorec | Primer |
|---|---|---|
| T1 | `[Nome], abbiamo prenotato il tuo appuntamento: [kdaj]. [Closing] [P]` | Maja, abbiamo prenotato il tuo appuntamento: domani alle 18:00. A presto! Fit Studio |
| T2 | `Ciao [Nome]! Ti abbiamo riservato un appuntamento per [servizio]: [kdaj]. [P]` | Ciao Maja! Ti abbiamo riservato un appuntamento per l'allenamento: venerdi alle 18:00. Fit Studio |
| T3 | `Grazie per la prenotazione, [Nome]! Appuntamento: [kdaj]. [Closing] [P]` | Grazie per la prenotazione, Maja! Appuntamento: domani alle 18:00. Ci vediamo! Fit Studio |
| T4 | `[Nome], abbiamo registrato il tuo appuntamento [kdaj]. Grazie per la fiducia! [P]` | Maja, abbiamo registrato il tuo appuntamento venerdi alle 18:00. Grazie per la fiducia! Fit Studio |
| T5 | `Perfetto, [Nome]! Appuntamento fissato: [kdaj]. [Closing] [P]` | Perfetto, Maja! Appuntamento fissato: domani alle 18:00. A presto! Fit Studio |
| T6 | `[Nome], ti abbiamo fissato un appuntamento: [kdaj]. [Closing] [P]` | Maja, ti abbiamo fissato un appuntamento: domani alle 18:00. Buona giornata! Fit Studio |

### Opomnik: formalno (Lei)
| # | Vzorec | Primer |
|---|---|---|
| P1 | `[Nome], [kdaj] alle [ora] ha un appuntamento da noi. [Closing] [P]` | Maja, domani alle 9:00 ha un appuntamento da noi. A presto! Salon Ana |
| P2 | `[Nome], a presto: [kdaj] alle [ora]. [Closing] [P]` | Maja, a presto: domani alle 9:00. Buona giornata! Salon Ana |
| P3 | `Buongiorno [Nome]! Un cortese promemoria: appuntamento [kdaj] alle [ora]. [P]` | Buongiorno Maja! Un cortese promemoria: appuntamento venerdi alle 9:00. Salon Ana |
| P4 | `[Nome], ci vediamo [kdaj] alle [ora]! [Closing] [P]` | Maja, ci vediamo domani alle 9:00! Buona giornata! Salon Ana |
| P5 | `[Nome], [kdaj] alle [ora] ha un appuntamento per [servizio]. [Closing] [P]` | Maja, domani alle 9:00 ha un appuntamento per un taglio. A presto! Salon Ana |
| P6 | `[Nome], solo un breve promemoria: [kdaj] alle [ora] ha un appuntamento. [P]` | Maja, solo un breve promemoria: venerdi alle 9:00 ha un appuntamento. Salon Ana |

### Opomnik: neformalno (tu)
| # | Vzorec | Primer |
|---|---|---|
| T1 | `[Nome], [kdaj] alle [ora] hai un appuntamento da noi. [Closing] [P]` | Maja, domani alle 18:00 hai un appuntamento da noi. A presto! Fit Studio |
| T2 | `[Nome], a presto: [kdaj] alle [ora]. [Closing] [P]` | Maja, a presto: domani alle 18:00. Buona giornata! Fit Studio |
| T3 | `[Nome], non vediamo l'ora di vederti [kdaj] alle [ora]! [P]` | Maja, non vediamo l'ora di vederti domani alle 18:00! Fit Studio |
| T4 | `[Nome], ci vediamo [kdaj] alle [ora]! [Closing] [P]` | Maja, ci vediamo domani alle 18:00! Buona giornata! Fit Studio |
| T5 | `[Nome], [kdaj] alle [ora] hai un appuntamento per [servizio]. [Closing] [P]` | Maja, domani alle 18:00 hai un appuntamento per l'allenamento. A presto! Fit Studio |

Zaključki: A presto · Ci vediamo · Buona giornata · Benvenuto/Benvenuta. Prepovedano: »contiamo su di Lei«, »il Suo appuntamento La attende«, »Le comunichiamo che La aspettiamo«.

---

## Za tvojo odločitev

1. Slovenščine in verjetno hrvaščine ti ni treba preverjati s tujcem. Za **DE, IT in EN** priporočam, da jih pogleda človek, ki jezik zna (ali jih prilepiš na kratko v pogovor z nekom, ki tam živi), preden gredo v prompt.
2. Pri hrvaščini: ali ostane pravilo, da AI ob dvomu o vokativu ime izpusti?
3. Pri angleščini: ura »9 AM« ali 24-urni zapis (»9:00«)? Predlagam »9 AM«.
