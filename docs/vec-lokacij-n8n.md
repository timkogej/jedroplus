# Več lokacij: pregled n8n workflowov

Stanje 2. 11. 2026, branje prek n8n API (nič ni spremenjeno). Delovni izvod je v
`n8n.jedroplus.com`; 120 workflowov, od tega so za lokacije pomembni spodnji.

## Pravilo za vse spremembe

- Podjetje z eno lokacijo ne sme opaziti nobene razlike. Glavna lokacija je že
  usklajena s starimi polji v `Podatki podjetij`, zato je vsak »prepis z
  lokacijo termina« pri eni lokaciji enak današnjemu rezultatu.
- Vsak workflow pred spremembo dobi varnostno kopijo v `~/n8n-backup/<datum>-<ime>/`
  in skripto `uveljavi.py` z možnostjo `nazaj` (isti vzorec kot doslej).
- Termin brez `lokacija_id` dobi glavno lokacijo v bazi (sprožilec), zato ni
  treba spremeniti vsega naenkrat.

## A. Zapisovanje terminov: `Vpisovanje podatkov` (q5ygmsf6UkxrUC0I, 242 vozlišč)

Najmanjša sprememba z največjim učinkom.

| Vozlišče | Sprememba |
|---|---|
| `Zapiši nov termin` | dodaj polje `lokacija_id` iz `podatkiTermina.lokacija_id` (prazno = `null`) |
| `Posodobi termin` | isto; pri prestavitvi se lokacija sme spremeniti samo, če je `lokacija_id` v zahtevi |
| ustvarjanje in posodobitev dogodka (`USTVARI_DOGODEK`, `POSODOBI_DOGODEK`) | dodaj polje `lokacija_id` v zapis `events` (prazno = `null` = velja za vse lokacije); aplikacija ga že pošilja kot polje najvišje ravni |
| ustvarjanje in posodobitev zaposlenega / vira / storitve | `lokacija_id` ni potreben, povezave piše `/api/locations/assign` |
| veje za sporočila (`Get company`, `Get company sms`, `Company`, `... - potrdilo`) | naslov in telefon iz lokacije termina (glej C) |

Preverjanje (nova vozlišča, najprej v testnem podjetju): zaposleni in vir
pripadata lokaciji termina (`Osebe_Lokacije`, `Resursi.lokacija_id`), sicer
napaka `person_not_at_location` / `resource_not_at_location`.

Aplikacija pošlje `lokacija_id` v `lib/webhookPayloadBuilders.ts` (okoli vrstice
848, `podatkiTermina`); polje v obrazcu termina dodamo hkrati.

## B. Spletna rezervacija: `Jedroplus Booking v2` (XdrhufTyyypyYtey, 211 vozlišč)

Dotakne se: Resursi (27 vozlišč), Termini (10), Podatki podjetij (12), Storitve (8), Osebe (6), events/absences (2), urnik (2).

1. `init`: vrne seznam aktivnih lokacij; ob eni lokaciji ostane odgovor enak.
2. `slots`, `check-slots`, `create`: sprejmejo `lokacijaId` (obvezen pri več lokacijah).
3. `Slots: Generate` in `Create: Resolve` danes blokirata, če je KATERIKOLI vir storitve zaseden: viri morajo biti filtrirani po lokaciji (pazi: to je znana past).
4. Urnik: `Lokacije.urnik` (podjetje), `Osebe_Lokacije.urnik` (oseba na lokaciji), nato `Osebe.Urnik`.
5. Zasedenost zaposlenega ostane po osebi (preprečuje dvojno rezervacijo čez lokacije); čas poti `cas_poti_min` je neobvezen, privzeto 0.
6. Potrdilo po rezervaciji: naslov, telefon in povezava za oceno lokacije termina.
7. Storitve: samo tiste z `Storitve_Lokacije` za lokacijo ali brez vrstic.

Booking-5 (odjemalec) dobi dodatni korak »Izberi lokacijo«, ki se pokaže samo pri več kot eni lokaciji.

## C. Sporočila: naslov in telefon lokacije termina

Danes vsi berejo `Naslov podjetja` in `Kontaktni telefon` iz `Podatki podjetij`:

| Workflow | ID | Vozlišča |
|---|---|---|
| Pošiljanje pred terminom: Pošlji stranki | meQeXzRKNRIDbsKl | `Podjetje stranke`, `Podjetje stranke SMS`, `Render SMS iz predloge`, `Ustvari opomnik` (×3), `Send an email based on a template` (×3) |
| Pošiljanje po terminu | XEEvewOSPhHtx9C4 | `Podatki o podjetju`, `Podjetje stranke SMS`, `Code za email`, `code` |
| PRESTAVITEV TERMINA | dytdy8khrqeFjV3y | `Get company`, `SMS – Podjetje`, `SMS – Kontekst` |
| Komunikacija: Pošlji sporočilo | 06VWDwj3cbYM4g0H | `Code - Build per-client variables` (sporočilo ni vezano na termin: glavna lokacija) |
| Komunikacija: Generiraj sporočilo | pCifb7WdsfrJzsw4 | samo glavna lokacija |
| Lost Leads | Tsz6kt181QYodXz1 | lokacija zadnjega obiska |
| test-message / email-send / sms-send | VsmHLRYySjeaLXFi, JTr8cAsLp8QYMrcB, HC3rVZ6tVxp2YyVs | preveriti, ali berejo naslov |

Predlog: ena skupna SQL funkcija `jp_lokacija_termina(termin)`, ki vrne naslov,
telefon in povezavo za oceno; v vsakem workflowu po `Get appointment` en HTTP
klic in `Code` vozlišče, ki prepiše polja v objektu podjetja, preden se sestavi
predloga. Ostalo (predloge, jeziki) ostane nespremenjeno.

## D. Portal strank (odloženo, čaka na Timov pregled)

`Get free slots` (ILoDZ1Nb7Nk1XEk3), `Get reschedule slots` (Q0a0pO3BQ90yJDIt),
`Confirm reschedule` (M9E8IUHNiLyJXTgR), `Cancel appointment` (95iOeLNDB5w0QmB6),
`Get customer appointments` (JDjeVGgHRwdQ8slC). Odločitev: prestavitev med
lokacijami v v1 ni mogoča, prestavitev ostane na isti lokaciji.

## E. Podjetja in člani

- `Ustvari podjetje` (BKzY3qI5BGaXwc5N): glavno lokacijo ustvari sprožilec; preveriti samo, da se `urnik` ne prepisuje po lokaciji.
- `Pridruži se podjetju` (5f55F5IdKvbOLfkl), `Povezava uporabnika z osebo` (b7TSxYzlx5VJn2ue): nova oseba dobi glavno lokacijo prek sprožilca; brez sprememb.
- `Chatbot+` (NGm36916Y9pc414l): se odstrani, ne spreminjamo.
- Receptionist+: Tim v ločenem pogovoru (razdelek 6.5 glavne analize).

## Predlagan vrstni red

1. A: `Vpisovanje podatkov` + polje v obrazcu termina (omogoči izbiro lokacije).
2. C: sporočila (pred terminom, po terminu, prestavitev), nato ostala.
3. B: Booking v2 + booking-5.
4. D: portal, ko Tim pregleda stanje.
