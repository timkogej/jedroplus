import { LEGAL_FACTS as F } from '../facts';
import type { LegalContent } from '../types';

const provider = `${F.provider}, ${F.address}, Slovenija, matična številka ${F.registrationNumber}`;

export const sl: LegalContent = {
  ui: {
    draftBanner:
      'Osnutek. Besedilo še ni pravno pregledano in se lahko spremeni.',
    lastUpdated: 'Velja od',
    bindingNote: '',
    otherDocuments: 'Drugi dokumenti',
    languageLabel: 'Jezik',
  },
  docs: {
    // ─────────────────────────────────────────────────────────────────────────
    terms: {
      title: 'Splošni pogoji uporabe',
      summary:
        'Pogoji, pod katerimi podjetja uporabljajo aplikacijo Jedro+ za naročanje, stranke, opomnike, Receptionist+ in druge funkcije.',
      sections: [
        {
          heading: '1. Ponudnik',
          blocks: [
            `Aplikacijo ${F.product} zagotavlja ${provider} (v nadaljevanju: »ponudnik«). Za storitev je pooblaščen in odgovoren ${F.representative}. Kontakt: ${F.email}.`,
            'Ponudnik ni zavezanec za DDV. Cene so končne, DDV ni obračunan na podlagi 1. odstavka 94. člena ZDDV-1.',
          ],
        },
        {
          heading: '2. Komu je storitev namenjena',
          blocks: [
            `${F.product} je namenjen izključno za poslovno rabo: podjetjem, samostojnim podjetnikom in drugim osebam, ki aplikacijo uporabljajo za opravljanje svoje dejavnosti (v nadaljevanju: »uporabnik«). Z registracijo uporabnik potrdi, da aplikacije ne uporablja kot potrošnik.`,
            'Ponudnik ne preverja, ali je dejavnost uporabnika registrirana. Uporabnik je sam odgovoren, da svojo dejavnost opravlja v skladu s predpisi, ki zanj veljajo (registracija, davki, varstvo osebnih podatkov, varstvo potrošnikov, oglaševanje).',
            'Za račun uporabnika odgovarja oseba, ki ga je ustvarila (lastnik). Lastnik lahko v račun povabi sodelavce in jim dodeli vloge; za njihovo ravnanje v aplikaciji odgovarja kot za svoje.',
          ],
        },
        {
          heading: '3. Kaj storitev obsega',
          blocks: [
            'Obseg funkcij je odvisen od izbranega paketa in dodatkov. Med drugim:',
            '- koledar, termini, storitve, zaposleni in viri;',
            '- evidenca strank in zgodovina terminov;',
            '- spletno naročanje in samostojna registracija strank prek javne povezave;',
            '- opomniki in obvestila strankam po e-pošti in SMS;',
            '- pošiljanje novic in ponudb strankam (Komunikacija);',
            '- Chatbot+ (AI klepet za stranke) in Receptionist+ (AI telefonska asistentka);',
            '- spletna plačila strank prek Stripe;',
            '- analitika, promocije in izvozi.',
            'Ponudnik lahko funkcije izboljšuje, spreminja ali ukine. Bistvenih poslabšanj plačanih funkcij ne uvede med že plačanim obdobjem brez predhodnega obvestila.',
          ],
        },
        {
          heading: '4. Registracija in dostop',
          blocks: [
            'Uporabnik mora ob registraciji navesti resnične podatke in jih posodabljati. Dostopne podatke (geslo, povezave za prijavo) mora varovati; o zlorabi mora ponudnika nemudoma obvestiti.',
            'Kode in povezave za pridružitev ekipi omogočajo dostop do podatkov podjetja, zato jih uporabnik deli samo z osebami, ki jim dostop dovoli.',
          ],
        },
        {
          heading: '5. Paketi, cene in plačilo',
          blocks: [
            'Veljavni paketi in cene so objavljeni v aplikaciji (Nastavitve → Paketi). Brezplačni paket vključuje enkratni preizkusni obseg sporočil, ki se ne obnavlja.',
            'Naročnina se plačuje vnaprej, mesečno ali letno, prek ponudnika plačil Stripe, in se samodejno podaljšuje, dokler je uporabnik ne odpove. Mesečni dodatki (SMS, e-pošta, dodatni uporabniki) se obračunajo skupaj z naročnino.',
            'Krediti za Receptionist+ se kupujejo v paketih z enkratnim plačilom. Ob prvi aktivaciji uporabnik prejme preizkusne kredite. Krediti ne potečejo in se ne vračajo.',
            'Ko je mesečni obseg SMS ali e-poštnih sporočil porabljen, se nadaljnja sporočila do obnove ali nakupa dodatka ne pošiljajo. SMS se pošiljajo samo na številke iz držav, ki jih aplikacija navaja (trenutno Slovenija, Hrvaška, Avstrija, Nemčija in Italija); za druge številke se uporabi e-pošta.',
            'Ponudnik lahko cene spremeni. Spremembo sporoči po e-pošti najmanj 30 dni vnaprej; velja od naslednjega obračunskega obdobja. Če se uporabnik s spremembo ne strinja, lahko naročnino odpove.',
          ],
        },
        {
          heading: '6. Odpoved',
          blocks: [
            'Uporabnik lahko naročnino odpove kadarkoli v aplikaciji ali prek Stripe portala. Odpoved začne veljati ob koncu plačanega obdobja; do takrat storitev deluje. Za tekoče ali neizkoriščeno obdobje se plačilo ne vrača, razen če zakon določa drugače.',
            'Ponudnik lahko dostop omeji ali pogodbo odpove, če uporabnik ne plača zapadlih zneskov, huje ali ponavljajoče krši te pogoje, ali če bi nadaljnje zagotavljanje storitve kršilo predpise. Razen pri hujših kršitvah uporabnika najprej opozori in mu da razumen rok za odpravo.',
            `Po koncu pogodbe ponudnik podatke uporabnika hrani še ${F.deletionAfterEndDays} dni, da jih lahko uporabnik izvozi ali naročnino obnovi, nato jih izbriše, razen podatkov, ki jih mora hraniti po zakonu (npr. računi).`,
          ],
        },
        {
          heading: '7. Obveznosti uporabnika',
          blocks: [
            'Uporabnik aplikacije ne sme uporabljati za nezakonite namene, za pošiljanje neželenih sporočil, za zbiranje podatkov tretjih brez pravne podlage, za motenje delovanja storitve ali za poskuse nepooblaščenega dostopa.',
            'Uporabnik je upravljavec osebnih podatkov svojih strank, zaposlenih in klicateljev, ki jih vnese ali zbere v aplikaciji. Zanje mora imeti pravno podlago in jih mora obvestiti o obdelavi. Ponudnik te podatke obdeluje kot obdelovalec po Pogodbi o obdelavi osebnih podatkov, ki je sestavni del teh pogojev.',
            'V aplikacijo uporabnik ne vnaša posebnih vrst osebnih podatkov (npr. podatkov o zdravju) brez ustrezne pravne podlage in samo v obsegu, ki je nujen.',
            'Za pošiljanje novic in ponudb (Komunikacija) mora uporabnik imeti ustrezno podlago (soglasje ali izjema za obstoječe stranke). Aplikacija vsakemu takemu sporočilu omogoča povezavo za odjavo in odjavljenim strankam ne pošilja več.',
            'Receptionist+ klice snema in prepisuje. Obvestilo o snemanju je privzeto vklopljeno; če ga uporabnik izklopi, je sam odgovoren za zakonitost snemanja.',
          ],
        },
        {
          heading: '8. Umetna inteligenca',
          blocks: [
            'Nekatere funkcije (predlogi sporočil, Chatbot+, Receptionist+) uporabljajo jezikovne in glasovne modele zunanjih ponudnikov. Odgovori so samodejno ustvarjeni in so lahko netočni ali nepopolni. Uporabnik mora preveriti pomembne podatke (npr. termine, cene, navodila) in nastaviti funkcije tako, da strankam ne dajejo zavajajočih informacij.',
            'Ponudnik podatkov strank ne uporablja za učenje modelov in ne dovoljuje, da bi jih v ta namen uporabljali ponudniki modelov.',
          ],
        },
        {
          heading: '9. Vsebina in pravice',
          blocks: [
            'Podatki in vsebine, ki jih vnese uporabnik, ostanejo njegovi. Ponudniku podeljuje pravico, da jih obdeluje v obsegu, ki je potreben za zagotavljanje storitve.',
            `Aplikacija, njena koda, oblikovanje in znamka ${F.product} so last ponudnika. Uporabnik pridobi neizključno, neprenosljivo pravico do uporabe v času trajanja pogodbe.`,
          ],
        },
        {
          heading: '10. Razpoložljivost',
          blocks: [
            'Ponudnik si prizadeva, da storitev deluje neprekinjeno, vendar tega ne jamči. Storitev je lahko začasno nedosegljiva zaradi vzdrževanja, posodobitev ali izpadov pri zunanjih ponudnikih (gostovanje, SMS, e-pošta, plačila, AI modeli). Načrtovana daljša vzdrževalna dela ponudnik vnaprej napove.',
          ],
        },
        {
          heading: '11. Odgovornost',
          blocks: [
            'Ponudnik odgovarja za škodo, ki jo povzroči namenoma ali iz hude malomarnosti. Za drugo škodo je odgovornost ponudnika omejena na znesek, ki ga je uporabnik ponudniku plačal v zadnjih 12 mesecih pred nastankom škode.',
            'Ponudnik ne odgovarja za posredno škodo (npr. izgubljen dobiček, izpadle termine), za škodo zaradi nepravilnih podatkov ali nastavitev uporabnika, za nedostavljena sporočila zaradi razlogov na strani operaterjev ali prejemnikov, za netočne odgovore AI funkcij, ki jih uporabnik ni preveril, in za izpade zunanjih ponudnikov, na katere nima vpliva.',
            'Uporabnik ponudnika odškoduje za zahtevke tretjih oseb, ki nastanejo zaradi njegove nezakonite rabe aplikacije ali kršitve teh pogojev.',
          ],
        },
        {
          heading: '12. Spremembe pogojev',
          blocks: [
            'Ponudnik lahko te pogoje spremeni. O bistvenih spremembah uporabnika obvesti po e-pošti najmanj 30 dni pred začetkom veljave. Če uporabnik po začetku veljave storitev uporablja naprej, velja, da se s spremembami strinja; če se ne strinja, lahko pred začetkom veljave naročnino odpove.',
          ],
        },
        {
          heading: '13. Pravo in spori',
          blocks: [
            'Za te pogoje velja pravo Republike Slovenije. Spore bosta stranki skušali rešiti sporazumno; sicer je pristojno stvarno pristojno sodišče v Ljubljani.',
            'Pogoji so objavljeni v več jezikih. V primeru razhajanj velja slovenska različica.',
          ],
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    privacy: {
      title: 'Politika zasebnosti',
      summary:
        'Kako Jedro+ obdeluje osebne podatke uporabnikov aplikacije in kako podatke strank salonov obdeluje v njihovem imenu.',
      sections: [
        {
          heading: '1. Upravljavec',
          blocks: [
            `Upravljavec osebnih podatkov uporabnikov aplikacije ${F.product} je ${provider}. Za varstvo podatkov je pooblaščen ${F.representative}. Kontakt za vsa vprašanja in zahteve: ${F.email}.`,
            'Za podatke strank, zaposlenih in klicateljev, ki jih podjetja (npr. saloni) vodijo v aplikaciji, je upravljavec to podjetje; ponudnik jih obdeluje le v njegovem imenu (glej točko 8).',
          ],
        },
        {
          heading: '2. Katere podatke obdelujemo',
          blocks: [
            '- Podatki računa: ime, e-poštni naslov, geslo (shranjeno kot zgoščena vrednost), vloga v ekipi, jezik aplikacije.',
            '- Podatki podjetja: naziv, dejavnost, naslov, država, davčna številka, kontaktni telefon in e-pošta, logotip, delovni čas, nastavitve.',
            '- Podatki o naročnini in plačilih: paket, dodatki, poraba sporočil, računi. Podatke plačilnih kartic obdeluje Stripe; ponudnik jih ne vidi.',
            '- Tehnični podatki: IP naslov in čas zahtev (za varnost in omejevanje zlorab), dnevniki napak na strežniku.',
            '- Komunikacija: sporočila, ki jih uporabnik pošlje ponudniku (npr. povpraševanja, podpora).',
          ],
        },
        {
          heading: '3. Nameni in pravne podlage',
          blocks: [
            '- Izvajanje pogodbe (6(1)(b) GDPR): ustvarjanje računa, zagotavljanje funkcij, obračun, podpora, obvestila o storitvi (npr. porabljena kvota, neuspelo plačilo).',
            '- Zakonske obveznosti (6(1)(c) GDPR): hramba računov in knjigovodskih listin.',
            '- Zakoniti interes (6(1)(f) GDPR): varnost in preprečevanje zlorab, odpravljanje napak, izboljševanje storitve na podlagi skupnih, neosebnih statistik.',
            'Podatkov ne prodajamo in jih ne uporabljamo za oglaševanje tretjih.',
          ],
        },
        {
          heading: '4. Kako dolgo hranimo podatke',
          blocks: [
            `- Podatki računa in podjetja: v času pogodbe in še ${F.deletionAfterEndDays} dni po njenem koncu, nato jih izbrišemo.`,
            '- Računi in knjigovodske listine: toliko, kot zahteva zakon (za račune 10 let).',
            '- Tehnični podatki za omejevanje zlorab: kratkotrajno; dnevniki napak: največ 30 dni.',
          ],
        },
        {
          heading: '5. Komu podatke posredujemo',
          blocks: [
            'Podatke obdelujejo skrbno izbrani obdelovalci (gostovanje, baza podatkov, e-pošta, SMS, plačila, telefonija, AI modeli), s katerimi imamo sklenjene pogodbe o obdelavi. Seznam je objavljen na strani »Podobdelovalci«.',
            'Podatke lahko posredujemo državnim organom, kadar to zahteva zakon.',
          ],
        },
        {
          heading: '6. Prenos izven EU',
          blocks: [
            'Baza podatkov, gostovanje aplikacije, e-pošta in strežnik za avtomatizacije so v EU. Nekateri ponudniki (AI jezikovni in glasovni modeli, telefonija, del plačilnega sistema) podatke obdelujejo tudi v ZDA. Prenos je zavarovan s standardnimi pogodbenimi klavzulami Evropske komisije in, kjer je ponudnik vključen, z okvirom EU-ZDA za zasebnost podatkov (Data Privacy Framework).',
          ],
        },
        {
          heading: '7. Piškotki',
          blocks: [
            'Aplikacija uporablja samo nujne piškotke in lokalno shrambo: za prijavo (seja), izbrani jezik in izbrano podjetje. Analitičnih, oglaševalskih ali sledilnih piškotkov ne uporabljamo, zato soglasje za piškotke ni potrebno.',
          ],
        },
        {
          heading: '8. Podatki strank salonov',
          blocks: [
            'Če ste stranka podjetja, ki uporablja Jedro+ (npr. salona), vaše podatke upravlja to podjetje. Ponudnik jih obdeluje le po njegovih navodilih, za naročanje, opomnike, obvestila in druge funkcije, ki jih podjetje uporablja. Za uveljavljanje pravic se obrnite neposredno na podjetje; ponudnik mu bo pri tem pomagal.',
            '- Obdelujejo se lahko: ime in priimek, e-pošta, telefonska številka, spol, jezik, opombe, zgodovina terminov, plačila, soglasje za obveščanje.',
            '- Novice in ponudbe: vsako tako sporočilo vsebuje povezavo za odjavo. Po odjavi jih ne prejemate več; opomniki za termine se še naprej pošiljajo.',
            `- Klici na Receptionist+: klic se snema in prepisuje, da AI asistentka lahko rezervira termin ali posreduje sporočilo. Na to ste opozorjeni na začetku klica. Posnetki in prepisi se hranijo ${F.callRetentionDays} dni.`,
            `- Evidenca poslanih SMS (številka, čas, stanje dostave) se hrani ${F.smsLogRetentionMonths} mesecev.`,
          ],
        },
        {
          heading: '9. Avtomatizirano odločanje',
          blocks: [
            'AI funkcije pripravljajo odgovore in predloge, ne sprejemajo pa odločitev, ki bi imele za posameznika pravne ali podobno pomembne učinke.',
          ],
        },
        {
          heading: '10. Varnost',
          blocks: [
            'Podatki so med prenosom šifrirani (HTTPS/TLS) in shranjeni pri ponudnikih z ustreznimi certifikati. Dostop je omejen z vlogami in pravili na ravni baze; podatki posameznega podjetja so ločeni od drugih. Dostop ima le pooblaščena oseba ponudnika, kadar je to potrebno za delovanje ali podporo.',
          ],
        },
        {
          heading: '11. Vaše pravice',
          blocks: [
            'Imate pravico do dostopa, popravka, izbrisa, omejitve obdelave, prenosljivosti in ugovora. Zahtevo pošljite na ' + F.email + '; odgovorimo najkasneje v enem mesecu.',
            'Pritožbo lahko vložite pri Informacijskem pooblaščencu RS, Dunajska cesta 22, 1000 Ljubljana, www.ip-rs.si, ali pri nadzornem organu v svoji državi.',
          ],
        },
        {
          heading: '12. Spremembe',
          blocks: [
            'Politiko lahko posodobimo. O bistvenih spremembah uporabnike obvestimo po e-pošti; datum veljavne različice je naveden na vrhu.',
          ],
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    dpa: {
      title: 'Pogodba o obdelavi osebnih podatkov',
      summary:
        'Pogodba po 28. členu GDPR med podjetjem, ki uporablja Jedro+ (upravljavec), in ponudnikom (obdelovalec). Je sestavni del Splošnih pogojev uporabe in velja s sprejetjem pogojev.',
      sections: [
        {
          heading: '1. Stranki',
          blocks: [
            '- Upravljavec: podjetje ali podjetnik, ki je sprejel Splošne pogoje uporabe aplikacije Jedro+ (»uporabnik«).',
            `- Obdelovalec: ${provider}, pooblaščena oseba ${F.representative}, ${F.email} (»ponudnik«).`,
          ],
        },
        {
          heading: '2. Predmet in trajanje',
          blocks: [
            'Ponudnik obdeluje osebne podatke v imenu uporabnika izključno za zagotavljanje aplikacije Jedro+ v obsegu funkcij, ki jih uporabnik uporablja. Pogodba velja, dokler velja pogodba o uporabi, in do izbrisa podatkov po njenem koncu.',
          ],
        },
        {
          heading: '3. Narava in namen obdelave',
          blocks: [
            'Shranjevanje, organizacija, prikaz, pošiljanje sporočil (e-pošta, SMS), sprejem in prepis telefonskih klicev, priprava odgovorov z AI modeli, obdelava spletnih plačil, izvoz in izbris — za vodenje terminov in strank, opomnike, obvestila, marketinška sporočila, spletno naročanje, Chatbot+ in Receptionist+.',
          ],
        },
        {
          heading: '4. Vrste podatkov in posamezniki',
          blocks: [
            '- Stranke uporabnika: ime, priimek, e-pošta, telefon, spol, jezik, opombe, tip stranke, zgodovina terminov, storitve, cene in popusti, stanje plačil, soglasje za obveščanje in odjava.',
            '- Klicatelji (Receptionist+): telefonska številka, posnetek in prepis pogovora, izid klica.',
            '- Obiskovalci klepeta (Chatbot+): vsebina pogovora in podatki, ki jih vpišejo.',
            '- Zaposleni uporabnika: ime, kontakt, urnik, odsotnosti, dodeljeni termini.',
            'Posebne vrste osebnih podatkov se obdelujejo le, če jih uporabnik vnese (npr. v opombe); uporabnik zagotovi pravno podlago in jih omeji na nujno.',
          ],
        },
        {
          heading: '5. Obveznosti ponudnika',
          blocks: [
            '- Podatke obdeluje samo po dokumentiranih navodilih uporabnika, ki jih ta daje z uporabo in nastavitvami aplikacije. Če meni, da je navodilo v nasprotju s predpisi, ga o tem obvesti.',
            '- Osebe, ki imajo dostop do podatkov, so zavezane k zaupnosti.',
            '- Izvaja tehnične in organizacijske ukrepe iz točke 7.',
            '- Uporabniku pomaga pri odgovarjanju na zahteve posameznikov (dostop, popravek, izbris, izvoz) in pri izpolnjevanju obveznosti iz 32. do 36. člena GDPR.',
            '- O kršitvi varnosti osebnih podatkov uporabnika obvesti brez nepotrebnega odlašanja, najkasneje v 48 urah po seznanitvi, z vsemi podatki, ki jih ima.',
            '- Uporabniku na zahtevo da informacije, potrebne za dokazovanje skladnosti, in omogoči razumne preglede (praviloma z dokumentacijo in pisnimi odgovori).',
          ],
        },
        {
          heading: '6. Podobdelovalci',
          blocks: [
            'Uporabnik daje splošno dovoljenje za podobdelovalce, navedene na strani »Podobdelovalci«. Ponudnik z vsakim sklene pogodbo z enakimi obveznostmi varstva podatkov in zanj odgovarja kot za svoje ravnanje.',
            'O dodajanju ali zamenjavi podobdelovalca ponudnik uporabnika obvesti najmanj 30 dni vnaprej (po e-pošti ali v aplikaciji). Uporabnik lahko iz utemeljenih razlogov ugovarja; če rešitve ni, lahko pogodbo odpove brez stroškov.',
            'Prenos v tretje države poteka le ob ustreznih zaščitnih ukrepih (standardne pogodbene klavzule, okvir EU-ZDA za zasebnost podatkov).',
          ],
        },
        {
          heading: '7. Tehnični in organizacijski ukrepi',
          blocks: [
            '- Šifriranje prenosa (TLS) in šifriranje shranjenih podatkov pri ponudniku baze.',
            '- Baza podatkov, gostovanje, e-pošta in strežnik za avtomatizacije v EU.',
            '- Ločevanje podatkov po podjetjih; pravila dostopa na ravni baze (RLS); pisanje podatkov le prek preverjenih strežniških poti.',
            '- Dostop po vlogah (lastnik, administrator, zaposleni) in načelo najmanjših pooblastil; tajni ključi samo na strežniku.',
            '- Omejevanje števila zahtev in zaščita pred zlorabami; podpisane povezave (npr. za odjavo).',
            '- Redne varnostne kopije pri ponudniku baze; beleženje sprememb terminov in strank.',
            '- Samodejni izbris posnetkov klicev po 90 dneh in podatkov po koncu pogodbe.',
          ],
        },
        {
          heading: '8. Obveznosti uporabnika',
          blocks: [
            '- Za obdelavo podatkov svojih strank, zaposlenih in klicateljev ima pravno podlago in jih o obdelavi obvesti (npr. v svoji politiki zasebnosti).',
            '- Marketinška sporočila pošilja le strankam, pri katerih ima za to podlago, in spoštuje odjave.',
            '- Pri Receptionist+ ohrani obvestilo o snemanju vklopljeno ali sam zagotovi zakonitost snemanja.',
            '- Dostope do aplikacije daje le osebam, ki jih potrebujejo, in jih pravočasno odvzame.',
          ],
        },
        {
          heading: '9. Konec obdelave',
          blocks: [
            `Po koncu pogodbe lahko uporabnik podatke izvozi. Ponudnik jih ${F.deletionAfterEndDays} dni po koncu izbriše, vključno s kopijami pri podobdelovalcih v okviru njihovih rokov za varnostne kopije, razen če hrambo zahteva zakon.`,
          ],
        },
        {
          heading: '10. Končne določbe',
          blocks: [
            'Za odgovornost veljajo določbe Splošnih pogojev uporabe, razen kadar GDPR določa drugače. Velja pravo Republike Slovenije. V primeru razhajanj med jezikovnimi različicami velja slovenska.',
          ],
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    subprocessors: {
      title: 'Podobdelovalci',
      summary:
        'Zunanji ponudniki, ki za Jedro+ obdelujejo osebne podatke. O spremembah obveščamo 30 dni vnaprej.',
      sections: [
        {
          heading: 'Infrastruktura (EU)',
          blocks: [
            '- Supabase — baza podatkov, prijava in hramba datotek — EU (Stockholm, Švedska)',
            '- Vercel — gostovanje aplikacije — EU (Stockholm, Švedska)',
            '- Hetzner Online — strežnik za avtomatizacije (n8n) — EU',
            '- Upstash — omejevanje števila zahtev (IP naslovi, kratkotrajno) — EU (Frankfurt, Nemčija)',
          ],
        },
        {
          heading: 'Sporočila',
          blocks: [
            '- Amazon Web Services (Amazon SES) — pošiljanje e-pošte — EU (Stockholm, Švedska)',
            '- BulkGate — pošiljanje SMS — EU (Češka)',
          ],
        },
        {
          heading: 'Plačila',
          blocks: [
            '- Stripe — naročnine, nakup kreditov in spletna plačila strank — EU (Irska), deloma ZDA',
          ],
        },
        {
          heading: 'Receptionist+ in AI funkcije',
          blocks: [
            '- Telnyx — telefonske številke in prenos klicev — ZDA in globalno omrežje',
            '- Soniox — prepoznava govora (prepis klicev) — ZDA',
            '- ElevenLabs — sinteza govora (glas asistentke) — ZDA',
            '- Anthropic (Claude) — jezikovni model za pogovore in predloge sporočil — ZDA',
            '- OpenAI — jezikovni model za pogovore in predloge sporočil — ZDA',
            'Pri ponudnikih v ZDA je prenos zavarovan s standardnimi pogodbenimi klavzulami in, kjer je ponudnik vključen, z okvirom EU-ZDA za zasebnost podatkov. Ponudniki AI modelov podatkov ne uporabljajo za učenje modelov.',
          ],
        },
      ],
    },
  },
};
