import { LEGAL_FACTS as F } from '../facts';
import type { LegalContent } from '../types';

const provider = `${F.provider}, ${F.address}, Slovenija, matični broj ${F.registrationNumber}`;

export const hr: LegalContent = {
  ui: {
    draftBanner: 'Nacrt. Tekst još nije pravno pregledan i može se promijeniti.',
    lastUpdated: 'Vrijedi od',
    bindingNote: 'Ovo je prijevod. U slučaju odstupanja vrijedi slovenska verzija.',
    otherDocuments: 'Ostali dokumenti',
    languageLabel: 'Jezik',
  },
  docs: {
    // ─────────────────────────────────────────────────────────────────────────
    terms: {
      title: 'Opći uvjeti korištenja',
      summary:
        'Uvjeti pod kojima tvrtke koriste aplikaciju Jedro+ za naručivanje, klijente, podsjetnike, Receptionist+ i druge funkcije.',
      sections: [
        {
          heading: '1. Pružatelj',
          blocks: [
            `Aplikaciju ${F.product} pruža ${provider} (u daljnjem tekstu: „pružatelj”). Za uslugu je ovlašten i odgovoran ${F.representative}. Kontakt: ${F.email}.`,
            'Pružatelj nije obveznik PDV-a. Cijene su konačne; PDV se ne obračunava na temelju članka 94. stavka 1. slovenskog Zakona o PDV-u (ZDDV-1).',
          ],
        },
        {
          heading: '2. Kome je usluga namijenjena',
          blocks: [
            `${F.product} je namijenjen isključivo poslovnoj upotrebi: tvrtkama, obrtnicima i drugim osobama koje aplikaciju koriste za obavljanje svoje djelatnosti (u daljnjem tekstu: „korisnik”). Registracijom korisnik potvrđuje da aplikaciju ne koristi kao potrošač.`,
            'Pružatelj ne provjerava je li djelatnost korisnika registrirana. Korisnik je sam odgovoran da svoju djelatnost obavlja u skladu s propisima koji se na njega odnose (registracija, porezi, zaštita osobnih podataka, zaštita potrošača, oglašavanje).',
            'Za račun odgovara osoba koja ga je otvorila (vlasnik). Vlasnik može pozvati suradnike i dodijeliti im uloge te za njihove radnje u aplikaciji odgovara kao za svoje.',
          ],
        },
        {
          heading: '3. Što usluga obuhvaća',
          blocks: [
            'Opseg funkcija ovisi o odabranom paketu i dodacima, među ostalim:',
            '- kalendar, termini, usluge, zaposlenici i resursi;',
            '- evidencija klijenata i povijest termina;',
            '- online naručivanje i samostalna registracija klijenata putem javne poveznice;',
            '- podsjetnici i obavijesti klijentima e-poštom i SMS-om;',
            '- slanje novosti i ponuda klijentima (Komunikacija);',
            '- Chatbot+ (AI chat za klijente) i Receptionist+ (AI telefonska asistentica);',
            '- online plaćanja klijenata putem Stripea;',
            '- analitika, promocije i izvozi.',
            'Pružatelj može funkcije poboljšavati, mijenjati ili ukinuti. Bitna smanjenja plaćenih funkcija ne uvodi tijekom već plaćenog razdoblja bez prethodne obavijesti.',
          ],
        },
        {
          heading: '4. Registracija i pristup',
          blocks: [
            'Korisnik mora navesti istinite podatke i ažurirati ih, čuvati pristupne podatke (lozinke, poveznice za prijavu) i pružatelja odmah obavijestiti o zlouporabi.',
            'Kodovi i poveznice za pridruživanje timu omogućuju pristup podacima tvrtke pa ih korisnik dijeli samo s osobama kojima dopušta pristup.',
          ],
        },
        {
          heading: '5. Paketi, cijene i plaćanje',
          blocks: [
            'Važeći paketi i cijene objavljeni su u aplikaciji (Postavke → Paketi). Besplatni paket uključuje jednokratnu probnu količinu poruka koja se ne obnavlja.',
            'Pretplata se plaća unaprijed, mjesečno ili godišnje, putem pružatelja plaćanja Stripe i automatski se produljuje dok je korisnik ne otkaže. Mjesečni dodaci (SMS, e-pošta, dodatni korisnici) obračunavaju se zajedno s pretplatom.',
            'Krediti za Receptionist+ kupuju se u paketima jednokratnim plaćanjem. Pri prvoj aktivaciji korisnik dobiva probne kredite. Krediti ne istječu i ne vraćaju se.',
            'Kad se mjesečna količina SMS ili e-poruka potroši, daljnje se poruke ne šalju do obnove ili kupnje dodatka. SMS se šalje samo na brojeve iz država navedenih u aplikaciji (trenutačno Slovenija, Hrvatska, Austrija, Njemačka i Italija); ostali brojevi dobivaju e-poštu.',
            'Pružatelj može promijeniti cijene. Promjenu najavljuje e-poštom najmanje 30 dana unaprijed; vrijedi od sljedećeg obračunskog razdoblja. Ako se korisnik ne slaže, može otkazati pretplatu.',
          ],
        },
        {
          heading: '6. Otkaz',
          blocks: [
            'Korisnik može otkazati u bilo kojem trenutku u aplikaciji ili putem Stripe portala. Otkaz stupa na snagu na kraju plaćenog razdoblja; do tada usluga radi. Plaćanja za tekuće ili neiskorišteno razdoblje ne vraćaju se, osim ako zakon ne propisuje drukčije.',
            'Pružatelj može ograničiti pristup ili raskinuti ugovor ako korisnik ne plati dospjele iznose, teško ili opetovano krši ove uvjete ili ako bi daljnje pružanje usluge kršilo propise. Osim kod teških povreda, korisnika najprije upozori i da mu razuman rok za otklanjanje.',
            `Nakon prestanka ugovora pružatelj podatke korisnika čuva još ${F.deletionAfterEndDays} dana kako bi ih korisnik mogao izvesti ili obnoviti pretplatu, a zatim ih briše, osim podataka koje mora čuvati po zakonu (npr. računi).`,
          ],
        },
        {
          heading: '7. Obveze korisnika',
          blocks: [
            'Korisnik ne smije koristiti aplikaciju u nezakonite svrhe, za slanje neželjenih poruka, za prikupljanje podataka trećih osoba bez pravne osnove, za ometanje usluge ili pokušaje neovlaštenog pristupa.',
            'Korisnik je voditelj obrade osobnih podataka svojih klijenata, zaposlenika i pozivatelja koje unosi ili prikuplja u aplikaciji. Za to mora imati pravnu osnovu i o obradi ih obavijestiti. Pružatelj te podatke obrađuje kao izvršitelj obrade prema Ugovoru o obradi osobnih podataka, koji je sastavni dio ovih uvjeta.',
            'Posebne kategorije osobnih podataka (npr. podatke o zdravlju) korisnik unosi samo uz odgovarajuću pravnu osnovu i samo u nužnom opsegu.',
            'Za slanje novosti i ponuda (Komunikacija) korisnik mora imati odgovarajuću osnovu (privolu ili iznimku za postojeće klijente). Aplikacija svakoj takvoj poruci dodaje poveznicu za odjavu i odjavljenim klijentima više ne šalje.',
            'Receptionist+ snima i prepisuje pozive. Obavijest o snimanju uključena je prema zadanim postavkama; ako je korisnik isključi, sam je odgovoran za zakonitost snimanja.',
          ],
        },
        {
          heading: '8. Umjetna inteligencija',
          blocks: [
            'Neke funkcije (prijedlozi poruka, Chatbot+, Receptionist+) koriste jezične i glasovne modele vanjskih pružatelja. Odgovori se generiraju automatski i mogu biti netočni ili nepotpuni. Korisnik mora provjeriti važne podatke (npr. termine, cijene, upute) i postaviti funkcije tako da klijente ne dovode u zabludu.',
            'Pružatelj ne koristi podatke klijenata za učenje modela i to ne dopušta ni pružateljima modela.',
          ],
        },
        {
          heading: '9. Sadržaj i prava',
          blocks: [
            'Podaci i sadržaji koje korisnik unese ostaju njegovi. Pružatelju daje pravo da ih obrađuje u opsegu potrebnom za pružanje usluge.',
            `Aplikacija, njezin kod, dizajn i marka ${F.product} vlasništvo su pružatelja. Korisnik stječe neisključivo, neprenosivo pravo korištenja za vrijeme trajanja ugovora.`,
          ],
        },
        {
          heading: '10. Dostupnost',
          blocks: [
            'Pružatelj nastoji da usluga radi bez prekida, ali to ne jamči. Usluga može biti privremeno nedostupna zbog održavanja, ažuriranja ili ispada kod vanjskih pružatelja (hosting, SMS, e-pošta, plaćanja, AI modeli). Dulja planirana održavanja najavljuju se unaprijed.',
          ],
        },
        {
          heading: '11. Odgovornost',
          blocks: [
            'Pružatelj odgovara za štetu prouzročenu namjerno ili krajnjom nepažnjom. Za ostalu štetu odgovornost je ograničena na iznos koji je korisnik platio pružatelju u 12 mjeseci prije nastanka štete.',
            'Pružatelj ne odgovara za neizravnu štetu (npr. izgubljenu dobit, propuštene termine), štetu zbog netočnih podataka ili postavki korisnika, neisporučene poruke iz razloga na strani operatera ili primatelja, netočne AI odgovore koje korisnik nije provjerio te ispade vanjskih pružatelja na koje ne može utjecati.',
            'Korisnik obeštećuje pružatelja za zahtjeve trećih osoba koji nastanu zbog njegove nezakonite upotrebe aplikacije ili kršenja ovih uvjeta.',
          ],
        },
        {
          heading: '12. Izmjene uvjeta',
          blocks: [
            'Pružatelj može izmijeniti ove uvjete. O bitnim izmjenama korisnika obavještava e-poštom najmanje 30 dana prije stupanja na snagu. Ako korisnik nakon toga nastavi koristiti uslugu, smatra se da ih prihvaća; ako se ne slaže, može otkazati prije stupanja na snagu.',
          ],
        },
        {
          heading: '13. Pravo i sporovi',
          blocks: [
            'Na ove uvjete primjenjuje se pravo Republike Slovenije. Stranke će sporove nastojati riješiti sporazumno; u protivnom je nadležan stvarno nadležni sud u Ljubljani.',
            'Uvjeti su objavljeni na više jezika. U slučaju odstupanja vrijedi slovenska verzija.',
          ],
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    privacy: {
      title: 'Politika privatnosti',
      summary:
        'Kako Jedro+ obrađuje osobne podatke korisnika aplikacije i kako u ime salona obrađuje podatke njihovih klijenata.',
      sections: [
        {
          heading: '1. Voditelj obrade',
          blocks: [
            `Voditelj obrade osobnih podataka korisnika aplikacije ${F.product} je ${provider}. Za zaštitu podataka zadužen je ${F.representative}. Kontakt za sva pitanja i zahtjeve: ${F.email}.`,
            'Za podatke klijenata, zaposlenika i pozivatelja koje tvrtke (npr. saloni) vode u aplikaciji voditelj obrade je ta tvrtka; pružatelj ih obrađuje samo u njezino ime (vidi točku 8).',
          ],
        },
        {
          heading: '2. Koje podatke obrađujemo',
          blocks: [
            '- Podaci računa: ime, adresa e-pošte, lozinka (pohranjena kao sažetak), uloga u timu, jezik aplikacije.',
            '- Podaci tvrtke: naziv, djelatnost, adresa, država, porezni broj, kontaktni telefon i e-pošta, logotip, radno vrijeme, postavke.',
            '- Podaci o pretplati i plaćanjima: paket, dodaci, potrošnja poruka, računi. Podatke platnih kartica obrađuje Stripe; pružatelj ih ne vidi.',
            '- Tehnički podaci: IP adresa i vrijeme zahtjeva (za sigurnost i sprječavanje zlouporabe), zapisi pogrešaka poslužitelja.',
            '- Komunikacija: poruke koje korisnik šalje pružatelju (npr. upiti, podrška).',
          ],
        },
        {
          heading: '3. Svrhe i pravne osnove',
          blocks: [
            '- Izvršenje ugovora (čl. 6. st. 1. t. b) GDPR-a): otvaranje računa, pružanje funkcija, obračun, podrška, obavijesti o usluzi (npr. potrošena kvota, neuspjelo plaćanje).',
            '- Zakonske obveze (čl. 6. st. 1. t. c) GDPR-a): čuvanje računa i knjigovodstvenih isprava.',
            '- Legitimni interes (čl. 6. st. 1. t. f) GDPR-a): sigurnost i sprječavanje zlouporabe, otklanjanje pogrešaka, poboljšanje usluge na temelju skupnih, neosobnih statistika.',
            'Podatke ne prodajemo i ne koristimo ih za oglašavanje trećih.',
          ],
        },
        {
          heading: '4. Koliko dugo čuvamo podatke',
          blocks: [
            `- Podaci računa i tvrtke: tijekom trajanja ugovora i ${F.deletionAfterEndDays} dana nakon njegova prestanka, zatim se brišu.`,
            '- Računi i knjigovodstvene isprave: onoliko koliko propisuje zakon (za račune 10 godina).',
            '- Tehnički podaci za sprječavanje zlouporabe: kratkoročno; zapisi pogrešaka: najviše 30 dana.',
          ],
        },
        {
          heading: '5. Kome prosljeđujemo podatke',
          blocks: [
            'Podatke obrađuju pažljivo odabrani izvršitelji obrade (hosting, baza podataka, e-pošta, SMS, plaćanja, telefonija, AI modeli) s kojima imamo sklopljene ugovore o obradi. Popis je objavljen na stranici „Podizvršitelji obrade”.',
            'Podatke možemo proslijediti tijelima javne vlasti kada to zahtijeva zakon.',
          ],
        },
        {
          heading: '6. Prijenos izvan EU-a',
          blocks: [
            'Baza podataka, hosting aplikacije, e-pošta i poslužitelj za automatizacije nalaze se u EU-u. Neki pružatelji (AI jezični i glasovni modeli, telefonija, dio sustava plaćanja) podatke obrađuju i u SAD-u. Prijenos je zaštićen standardnim ugovornim klauzulama Europske komisije i, gdje je pružatelj uključen, Okvirom za privatnost podataka EU-a i SAD-a (Data Privacy Framework).',
          ],
        },
        {
          heading: '7. Kolačići',
          blocks: [
            'Aplikacija koristi samo nužne kolačiće i lokalnu pohranu: za prijavu (sesija), odabrani jezik i odabranu tvrtku. Analitičke, oglašivačke ili kolačiće za praćenje ne koristimo pa privola za kolačiće nije potrebna.',
          ],
        },
        {
          heading: '8. Podaci klijenata salona',
          blocks: [
            'Ako ste klijent tvrtke koja koristi Jedro+ (npr. salona), vašim podacima upravlja ta tvrtka. Pružatelj ih obrađuje samo prema njezinim uputama, za naručivanje, podsjetnike, obavijesti i druge funkcije koje tvrtka koristi. Za ostvarivanje prava obratite se izravno tvrtki; pružatelj će joj u tome pomoći.',
            '- Mogu se obrađivati: ime i prezime, e-pošta, broj telefona, spol, jezik, bilješke, povijest termina, plaćanja, privola za obavještavanje.',
            '- Novosti i ponude: svaka takva poruka sadrži poveznicu za odjavu. Nakon odjave ih više ne primate; podsjetnici za termine i dalje se šalju.',
            `- Pozivi na Receptionist+: poziv se snima i prepisuje kako bi AI asistentica mogla rezervirati termin ili prenijeti poruku. Na to ste upozoreni na početku poziva. Snimke i prijepisi čuvaju se ${F.callRetentionDays} dana.`,
            `- Evidencija poslanih SMS poruka (broj, vrijeme, status isporuke) čuva se ${F.smsLogRetentionMonths} mjeseci.`,
          ],
        },
        {
          heading: '9. Automatizirano odlučivanje',
          blocks: [
            'AI funkcije pripremaju odgovore i prijedloge, ali ne donose odluke s pravnim ili sličnim značajnim učincima na pojedince.',
          ],
        },
        {
          heading: '10. Sigurnost',
          blocks: [
            'Podaci su tijekom prijenosa šifrirani (HTTPS/TLS) i pohranjeni kod certificiranih pružatelja. Pristup je ograničen ulogama i pravilima na razini baze; podaci svake tvrtke odvojeni su od ostalih. Pristup ima samo ovlaštena osoba pružatelja kada je to potrebno za rad ili podršku.',
          ],
        },
        {
          heading: '11. Vaša prava',
          blocks: [
            `Imate pravo na pristup, ispravak, brisanje, ograničenje obrade, prenosivost i prigovor. Zahtjev pošaljite na ${F.email}; odgovaramo najkasnije u roku od mjesec dana.`,
            'Pritužbu možete podnijeti slovenskom Povjereniku za informiranje (Informacijski pooblaščenec), Dunajska cesta 22, 1000 Ljubljana, www.ip-rs.si, ili nadzornom tijelu u svojoj državi (u Hrvatskoj: AZOP).',
          ],
        },
        {
          heading: '12. Izmjene',
          blocks: [
            'Politiku možemo ažurirati. O bitnim izmjenama korisnike obavještavamo e-poštom; datum važeće verzije naveden je na vrhu.',
          ],
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    dpa: {
      title: 'Ugovor o obradi osobnih podataka',
      summary:
        'Ugovor prema članku 28. GDPR-a između tvrtke koja koristi Jedro+ (voditelj obrade) i pružatelja (izvršitelj obrade). Sastavni je dio Općih uvjeta korištenja i vrijedi njihovim prihvaćanjem.',
      sections: [
        {
          heading: '1. Stranke',
          blocks: [
            '- Voditelj obrade: tvrtka ili obrtnik koji je prihvatio Opće uvjete korištenja aplikacije Jedro+ („korisnik”).',
            `- Izvršitelj obrade: ${provider}, ovlaštena osoba ${F.representative}, ${F.email} („pružatelj”).`,
          ],
        },
        {
          heading: '2. Predmet i trajanje',
          blocks: [
            'Pružatelj obrađuje osobne podatke u ime korisnika isključivo radi pružanja aplikacije Jedro+ u opsegu funkcija koje korisnik koristi. Ugovor vrijedi dok vrijedi ugovor o korištenju i do brisanja podataka nakon njegova prestanka.',
          ],
        },
        {
          heading: '3. Priroda i svrha obrade',
          blocks: [
            'Pohrana, organizacija, prikaz, slanje poruka (e-pošta, SMS), primanje i prepisivanje telefonskih poziva, priprema odgovora AI modelima, obrada online plaćanja, izvoz i brisanje — za vođenje termina i klijenata, podsjetnike, obavijesti, marketinške poruke, online naručivanje, Chatbot+ i Receptionist+.',
          ],
        },
        {
          heading: '4. Vrste podataka i ispitanici',
          blocks: [
            '- Klijenti korisnika: ime, prezime, e-pošta, telefon, spol, jezik, bilješke, vrsta klijenta, povijest termina, usluge, cijene i popusti, status plaćanja, privola za obavještavanje i odjava.',
            '- Pozivatelji (Receptionist+): broj telefona, snimka i prijepis razgovora, ishod poziva.',
            '- Posjetitelji chata (Chatbot+): sadržaj razgovora i podaci koje unesu.',
            '- Zaposlenici korisnika: ime, kontakt, raspored, odsutnosti, dodijeljeni termini.',
            'Posebne kategorije podataka obrađuju se samo ako ih korisnik unese (npr. u bilješke); korisnik osigurava pravnu osnovu i ograničava ih na nužno.',
          ],
        },
        {
          heading: '5. Obveze pružatelja',
          blocks: [
            '- Obrađuje podatke samo prema dokumentiranim uputama korisnika, koje ovaj daje korištenjem i postavkama aplikacije, te ga obavještava ako smatra da je uputa protivna propisima.',
            '- Osobe s pristupom podacima obvezuje na povjerljivost.',
            '- Provodi tehničke i organizacijske mjere iz točke 7.',
            '- Pomaže korisniku pri odgovaranju na zahtjeve ispitanika (pristup, ispravak, brisanje, izvoz) i pri ispunjavanju obveza iz članaka 32. do 36. GDPR-a.',
            '- O povredi osobnih podataka obavještava korisnika bez nepotrebnog odgađanja, najkasnije 48 sati nakon saznanja, sa svim dostupnim informacijama.',
            '- Na zahtjev daje informacije potrebne za dokazivanje usklađenosti i omogućuje razumne provjere (u pravilu dokumentacijom i pisanim odgovorima).',
          ],
        },
        {
          heading: '6. Podizvršitelji obrade',
          blocks: [
            'Korisnik daje opće odobrenje za podizvršitelje navedene na stranici „Podizvršitelji obrade”. Pružatelj svakog od njih obvezuje na iste obveze zaštite podataka i za njih odgovara kao za sebe.',
            'O dodavanju ili zamjeni podizvršitelja pružatelj obavještava korisnika najmanje 30 dana unaprijed (e-poštom ili u aplikaciji). Korisnik može iz opravdanih razloga uložiti prigovor; ako se ne nađe rješenje, može raskinuti ugovor bez troškova.',
            'Prijenos u treće zemlje odvija se samo uz odgovarajuće zaštitne mjere (standardne ugovorne klauzule, Okvir EU-a i SAD-a za privatnost podataka).',
          ],
        },
        {
          heading: '7. Tehničke i organizacijske mjere',
          blocks: [
            '- Šifriranje prijenosa (TLS) i šifriranje pohranjenih podataka kod pružatelja baze.',
            '- Baza podataka, hosting, e-pošta i poslužitelj za automatizacije u EU-u.',
            '- Odvajanje podataka po tvrtkama; pravila pristupa na razini baze (RLS); upis podataka samo putem provjerenih poslužiteljskih ruta.',
            '- Pristup prema ulogama (vlasnik, administrator, zaposlenik) i načelo najmanjih ovlasti; tajni ključevi samo na poslužitelju.',
            '- Ograničavanje broja zahtjeva i zaštita od zlouporabe; potpisane poveznice (npr. za odjavu).',
            '- Redovite sigurnosne kopije kod pružatelja baze; bilježenje promjena termina i klijenata.',
            '- Automatsko brisanje snimki poziva nakon 90 dana i podataka nakon prestanka ugovora.',
          ],
        },
        {
          heading: '8. Obveze korisnika',
          blocks: [
            '- Ima pravnu osnovu za obradu podataka svojih klijenata, zaposlenika i pozivatelja te ih o obradi obavještava (npr. u vlastitoj politici privatnosti).',
            '- Marketinške poruke šalje samo klijentima za koje za to ima osnovu i poštuje odjave.',
            '- Kod Receptionist+ ostavlja obavijest o snimanju uključenom ili sam osigurava zakonitost snimanja.',
            '- Pristup aplikaciji daje samo osobama kojima je potreban i pravodobno ga ukida.',
          ],
        },
        {
          heading: '9. Prestanak obrade',
          blocks: [
            `Nakon prestanka ugovora korisnik može izvesti podatke. Pružatelj ih briše ${F.deletionAfterEndDays} dana nakon prestanka, uključujući kopije kod podizvršitelja u okviru njihovih rokova za sigurnosne kopije, osim ako zakon zahtijeva čuvanje.`,
          ],
        },
        {
          heading: '10. Završne odredbe',
          blocks: [
            'Za odgovornost vrijede odredbe Općih uvjeta korištenja, osim ako GDPR određuje drukčije. Primjenjuje se pravo Republike Slovenije. U slučaju odstupanja jezičnih verzija vrijedi slovenska.',
          ],
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    subprocessors: {
      title: 'Podizvršitelji obrade',
      summary:
        'Vanjski pružatelji koji za Jedro+ obrađuju osobne podatke. O promjenama obavještavamo 30 dana unaprijed.',
      sections: [
        {
          heading: 'Infrastruktura (EU)',
          blocks: [
            '- Supabase — baza podataka, prijava i pohrana datoteka — EU (Stockholm, Švedska)',
            '- Vercel — hosting aplikacije — EU (Stockholm, Švedska)',
            '- Hetzner Online — poslužitelj za automatizacije (n8n) — EU',
            '- Upstash — ograničavanje broja zahtjeva (IP adrese, kratkoročno) — EU (Frankfurt, Njemačka)',
          ],
        },
        {
          heading: 'Poruke',
          blocks: [
            '- Amazon Web Services (Amazon SES) — slanje e-pošte — EU (Stockholm, Švedska)',
            '- BulkGate — slanje SMS poruka — EU (Češka)',
          ],
        },
        {
          heading: 'Plaćanja',
          blocks: [
            '- Stripe — pretplate, kupnja kredita i online plaćanja klijenata — EU (Irska), djelomično SAD',
          ],
        },
        {
          heading: 'Receptionist+ i AI funkcije',
          blocks: [
            '- Telnyx — telefonski brojevi i prijenos poziva — SAD i globalna mreža',
            '- Soniox — prepoznavanje govora (prijepis poziva) — SAD',
            '- ElevenLabs — sinteza govora (glas asistentice) — SAD',
            '- Anthropic (Claude) — jezični model za razgovore i prijedloge poruka — SAD',
            '- OpenAI — jezični model za razgovore i prijedloge poruka — SAD',
            'Kod pružatelja u SAD-u prijenos je zaštićen standardnim ugovornim klauzulama i, gdje je pružatelj uključen, Okvirom EU-a i SAD-a za privatnost podataka. Pružatelji AI modela podatke ne koriste za učenje modela.',
          ],
        },
      ],
    },
  },
};
