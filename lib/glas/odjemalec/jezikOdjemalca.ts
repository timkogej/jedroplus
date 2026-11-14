// lib/glas/odjemalec/jezikOdjemalca.ts
//
// Jezik pogovora v brskalniku (iz seje, /api/glas/seja → jezik) in besede, ki jih
// odjemalec prepozna sam, brez strežnika: da/ne, mašila, nedokončani stavki,
// "to je vse", "ponovi", "počasneje", prekinitev, ter kratki stavki, ki jih izgovori
// sam ("Moment.", "Shranjeno.").
//
// Slovenske množice ostanejo v besede.ts in tok.ts (nespremenjene); tu so drugi jeziki.
// Vse besede so brez naglasov in ločil (kot jih vrne brezLocil).

export type JezikOdjemalca = 'sl' | 'en' | 'de' | 'it' | 'hr';
type Tuj = Exclude<JezikOdjemalca, 'sl'>;

let trenutni: JezikOdjemalca = 'sl';

export function nastaviJezikOdjemalca(j: string | null | undefined): void {
  trenutni = j === 'en' || j === 'de' || j === 'it' || j === 'hr' ? j : 'sl';
}

export function jezikOdjemalca(): JezikOdjemalca {
  return trenutni;
}

export interface BesedeJezika {
  da: string[];
  ne: string[];
  masila: string[];
  nedokoncane: string[];
  konec: string[];
  zahvala: string[];
  ponovi: string[];
  pocasneje: string[];
  prekini: string[];
}

export const BESEDE: Record<Tuj, BesedeJezika> = {
  en: {
    da: ['yes', 'yeah', 'yep', 'yes please', 'confirm', 'sure', 'ok', 'okay', 'alright', 'all right', 'go ahead', 'save', 'save it', 'yes save', 'yes confirm', 'do it', 'correct', 'right', 'mhm', 'send', 'send it', 'yes send', 'yes send it', 'go', 'yes go ahead', 'sounds good'],
    ne: ['no', 'nope', 'no thanks', 'no thank you', 'cancel', 'stop', 'no no', 'leave it', 'never mind', 'dont', 'dont save', 'forget it', 'dont send', 'do not send', 'dont send it', 'no dont send', 'not now'],
    masila: ['uh', 'uhm', 'um', 'umm', 'er', 'erm', 'eh', 'hm', 'hmm', 'mm', 'well', 'like'],
    nedokoncane: [
      'at', 'for', 'with', 'on', 'in', 'to', 'from', 'by', 'of', 'about', 'until', 'till', 'before', 'after', 'around', 'between',
      'and', 'or', 'but', 'that', 'because', 'if', 'so', 'then', 'also', 'the', 'a', 'an', 'my', 'her', 'his', 'new', 'half', 'quarter', 'book', 'add', 'move', 'open',
    ],
    konec: ['thats all', 'that is all', 'thank you thats all', 'thanks thats all', 'thats it', 'thanks thats it', 'bye', 'goodbye', 'thanks bye', 'nothing else', 'thats everything', 'were done', 'done', 'you can stop', 'stop listening'],
    zahvala: ['thanks', 'thank you', 'thanks a lot', 'great thanks', 'ok thanks', 'okay thanks', 'perfect thanks', 'cheers'],
    ponovi: ['repeat', 'repeat that', 'say again', 'say that again', 'pardon', 'sorry', 'what', 'come again', 'can you repeat', 'repeat please', 'what did you say', 'i didnt catch that'],
    pocasneje: ['slower', 'slower please', 'slow down', 'more slowly', 'say it slower', 'repeat slower', 'speak slower'],
    prekini: ['stop', 'hey', 'no', 'yes', 'save', 'cancel', 'close', 'enough'],
  },
  de: {
    da: ['ja', 'jawohl', 'ja bitte', 'bestatigen', 'bestatige', 'klar', 'sicher', 'ok', 'okay', 'in ordnung', 'passt', 'genau', 'richtig', 'speichern', 'ja speichern', 'mach das', 'mhm', 'gerne', 'senden', 'ja senden', 'schick', 'schicken', 'schick es', 'schicks', 'ja schick', 'ja schicken', 'abschicken', 'ja abschicken', 'senden bitte'],
    ne: ['nein', 'nee', 'nein danke', 'abbrechen', 'stopp', 'stop', 'nein nein', 'lass es', 'lass das', 'nicht speichern', 'vergiss es', 'nicht senden', 'nicht schicken', 'nein nicht senden', 'jetzt nicht'],
    masila: ['ah', 'ahm', 'ahh', 'eh', 'ehm', 'em', 'hm', 'hmm', 'mm', 'also', 'naja'],
    nedokoncane: [
      'um', 'fur', 'mit', 'am', 'an', 'auf', 'in', 'im', 'zu', 'zum', 'zur', 'von', 'vom', 'bis', 'bei', 'beim', 'nach', 'vor', 'ab', 'gegen',
      'und', 'oder', 'aber', 'dass', 'weil', 'wenn', 'dann', 'auch', 'der', 'die', 'das', 'den', 'dem', 'ein', 'eine', 'einen', 'mein', 'meine', 'neuer', 'neuen', 'neue', 'halb', 'viertel', 'trag', 'verschieb', 'offne',
    ],
    konec: ['das wars', 'danke das wars', 'das ist alles', 'danke das ist alles', 'das war alles', 'tschuss', 'danke tschuss', 'auf wiedersehen', 'nichts mehr', 'fertig', 'ende', 'du kannst aufhoren'],
    zahvala: ['danke', 'danke schon', 'vielen dank', 'super danke', 'ok danke', 'okay danke', 'perfekt danke'],
    ponovi: ['wiederholen', 'wiederhole', 'bitte wiederholen', 'wie bitte', 'nochmal', 'noch einmal', 'nochmal bitte', 'was', 'was hast du gesagt', 'hab ich nicht verstanden'],
    pocasneje: ['langsamer', 'langsamer bitte', 'bitte langsamer', 'etwas langsamer', 'sprich langsamer', 'nochmal langsamer'],
    prekini: ['stopp', 'stop', 'moment', 'halt', 'hey', 'nein', 'ja', 'speichern', 'abbrechen', 'schliessen', 'genug'],
  },
  it: {
    da: ['si', 'si grazie', 'si per favore', 'conferma', 'confermo', 'certo', 'ok', 'okay', 'va bene', 'daccordo', 'perfetto', 'esatto', 'salva', 'si salva', 'si conferma', 'procedi', 'mhm', 'giusto', 'invia', 'si invia', 'invialo', 'inviala', 'manda', 'mandalo', 'si mandalo', 'si invialo', 'vai'],
    ne: ['no', 'no grazie', 'annulla', 'stop', 'no no', 'lascia stare', 'lascia perdere', 'non salvare', 'niente', 'basta', 'non inviare', 'non mandare', 'no non inviare', 'non ora'],
    masila: ['eh', 'ehm', 'em', 'mmm', 'mm', 'hm', 'hmm', 'cioe', 'allora', 'dunque', 'beh', 'boh'],
    nedokoncane: [
      'alle', 'alla', 'all', 'per', 'con', 'a', 'al', 'da', 'dal', 'dalle', 'di', 'del', 'della', 'in', 'nel', 'su', 'fino', 'prima', 'dopo', 'verso', 'tra', 'fra',
      'e', 'o', 'ma', 'che', 'perche', 'se', 'poi', 'anche', 'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'una', 'uno', 'mio', 'mia', 'nuovo', 'nuova', 'mezza', 'quarto', 'segna', 'sposta', 'aggiungi', 'apri',
    ],
    konec: ['e tutto', 'grazie e tutto', 'basta cosi', 'grazie basta cosi', 'e tutto grazie', 'ciao', 'grazie ciao', 'arrivederci', 'nientaltro', 'niente altro', 'fine', 'abbiamo finito', 'puoi smettere'],
    zahvala: ['grazie', 'grazie mille', 'ok grazie', 'okay grazie', 'perfetto grazie', 'ottimo grazie', 'molte grazie'],
    ponovi: ['ripeti', 'ripeti per favore', 'puoi ripetere', 'come', 'come scusa', 'scusa', 'cosa hai detto', 'non ho capito', 'di nuovo', 'ancora una volta'],
    pocasneje: ['piu piano', 'piu lentamente', 'piano', 'piu piano per favore', 'parla piu piano', 'ripeti piu piano'],
    prekini: ['stop', 'basta', 'ferma', 'ehi', 'no', 'si', 'salva', 'annulla', 'chiudi', 'momento'],
  },
  hr: {
    da: ['da', 'da molim', 'potvrdi', 'potvrdujem', 'naravno', 'moze', 'ok', 'okej', 'u redu', 'dobro', 'tako je', 'tocno', 'spremi', 'da spremi', 'da potvrdi', 'samo naprijed', 'mhm', 'ajde', 'posalji', 'da posalji', 'posalji ga', 'posalji je', 'salji', 'da salji', 'moze posalji', 'posaljite', 'da posaljite'],
    ne: ['ne', 'nee', 'ne hvala', 'otkazi', 'odustani', 'stop', 'ne ne', 'pusti', 'nije potrebno', 'ne spremaj', 'zaboravi', 'ne salji', 'ne saljite', 'nemoj slati', 'nemoj', 'ne posalji', 'ne sad'],
    masila: ['ovaj', 'eee', 'ee', 'em', 'ehm', 'hm', 'hmm', 'mm', 'aaa', 'pa', 'dakle', 'znaci'],
    // Brez "da": to je potrditev ("da" = ja), ne nedokončan stavek.
    nedokoncane: [
      'u', 'za', 'kod', 'na', 'sa', 's', 'k', 'prema', 'od', 'do', 'po', 'pod', 'nad', 'medu', 'prije', 'poslije', 'nakon', 'oko', 'bez', 'zbog', 'iz',
      'i', 'te', 'ili', 'ali', 'a', 'koji', 'koja', 'jer', 'kad', 'kada', 'ako', 'kao', 'onda', 'se', 'takoder', 'moj', 'moja', 'novi', 'nova', 'novu', 'pola', 'upisi', 'premjesti', 'dodaj', 'otvori',
    ],
    konec: ['to je sve', 'hvala to je sve', 'to je to', 'hvala to je to', 'to bi bilo sve', 'dovidenja', 'do vidjenja', 'bok', 'hvala bok', 'nista vise', 'hvala nista vise', 'kraj', 'gotovo', 'mozes prestati'],
    zahvala: ['hvala', 'hvala lijepa', 'hvala ti', 'hvala vam', 'super hvala', 'ok hvala', 'okej hvala', 'u redu hvala', 'odlicno hvala'],
    ponovi: ['ponovi', 'ponovi molim', 'molim ponovi', 'mozes ponoviti', 'ponovi jos jednom', 'jos jednom', 'sto si rekla', 'sto si rekao', 'nisam cuo', 'nisam cula', 'nisam razumio', 'nisam razumjela', 'molim', 'kako molim'],
    pocasneje: ['sporije', 'sporije molim', 'polako', 'malo sporije', 'govori sporije', 'ponovi sporije'],
    prekini: ['stop', 'stani', 'pricekaj', 'dosta', 'hej', 'ne', 'da', 'spremi', 'otkazi', 'zatvori', 'moment'],
  },
};

/** Stavki, ki jih odjemalec izgovori ali pokaže sam (brez strežnika). */
export interface BesedilaOdjemalca {
  konec: string;
  zahvala: string;
  nimamPonoviti: string;
  shranjeno: string;
  niUspelo: string;
  preklicanoZaslon: string;
  preklicanoGovor: string;
  nekajNiSlo: string;
  namigi: string[];
  mikrofon: string;
  brezMikrofona: string;
  povezava: string;
  razpoznava: string;
  casovna: string;
  nerazumljiv: string;
  // izidi obrazcev (AsistentPlus)
  poslano: string;
  zaprto: string;
  neObvescam: string;
  niShranjeno: string;
  preveri: string;
  uspeh: Record<'nov_termin' | 'prestavi_termin' | 'uredi_termin' | 'uredi_stranko' | 'odsotnost' | 'nova_stranka', string>;
}

export const BESEDILA: Record<JezikOdjemalca, BesedilaOdjemalca> = {
  sl: {
    konec: 'Prav. Lep dan.',
    zahvala: 'Prosim.',
    nimamPonoviti: 'Nimam česa ponoviti.',
    shranjeno: 'Shranjeno.',
    niUspelo: 'Ni uspelo. Nič ni bilo spremenjeno.',
    preklicanoZaslon: 'Preklicano. Nič ni bilo spremenjeno.',
    preklicanoGovor: 'Prav, preklicano.',
    nekajNiSlo: 'Nekaj ni šlo.',
    namigi: ['Moment.', 'Samo trenutek.', 'Preverim.'],
    mikrofon: 'Dostop do mikrofona ni dovoljen. Dovolite mikrofon za to stran v nastavitvah brskalnika.',
    brezMikrofona: 'Ta brskalnik ne podpira snemanja zvoka.',
    povezava: 'Povezava ni uspela. Nič ni bilo spremenjeno. Poskusite znova.',
    razpoznava: 'Razpoznava govora se je prekinila. Tapnite gumb za nov pogovor.',
    casovna: 'Asistent se ni odzval pravočasno. Nič ni bilo spremenjeno.',
    nerazumljiv: 'Neveljaven odgovor strežnika. Nič ni bilo spremenjeno.',
    poslano: "Poslano.",
    zaprto: "Prav, zaprto. Nič ni shranjeno.",
    neObvescam: "Prav, stranke ne obveščam.",
    niShranjeno: "Še ni shranjeno.",
    preveri: "Obrazec še ni shranjen. Poglejte ga, prosim.",
    uspeh: {
      nov_termin: "Super, termin je zapisan.",
      prestavi_termin: "Super, termin je prestavljen.",
      uredi_termin: "Super, termin je posodobljen.",
      uredi_stranko: "Super, podatki stranke so posodobljeni.",
      odsotnost: "Super, odsotnost je zapisana.",
      nova_stranka: "Super, stranka je dodana.",
    },
  },
  en: {
    konec: 'Okay. Have a nice day.',
    zahvala: "You're welcome.",
    nimamPonoviti: 'There is nothing to repeat.',
    shranjeno: 'Saved.',
    niUspelo: "That didn't work. Nothing was changed.",
    preklicanoZaslon: 'Cancelled. Nothing was changed.',
    preklicanoGovor: 'Okay, cancelled.',
    nekajNiSlo: 'Something went wrong.',
    namigi: ['One moment.', 'Just a second.', 'Let me check.'],
    mikrofon: "Microphone access isn't allowed. Allow the microphone for this site in your browser settings.",
    brezMikrofona: "This browser doesn't support audio recording.",
    povezava: "The connection failed. Nothing was changed. Please try again.",
    razpoznava: 'Speech recognition stopped. Tap the button to start a new conversation.',
    casovna: "The assistant didn't respond in time. Nothing was changed.",
    nerazumljiv: 'Invalid server response. Nothing was changed.',
    poslano: "Sent.",
    zaprto: "Okay, closed. Nothing was saved.",
    neObvescam: "Okay, I won't notify the client.",
    niShranjeno: "Not saved yet.",
    preveri: "The form isn't saved yet. Please take a look at it.",
    uspeh: {
      nov_termin: "Great, the appointment is booked.",
      prestavi_termin: "Great, the appointment is moved.",
      uredi_termin: "Great, the appointment is updated.",
      uredi_stranko: "Great, the client's details are updated.",
      odsotnost: "Great, the absence is recorded.",
      nova_stranka: "Great, the client is added.",
    },
  },
  de: {
    konec: 'Gut. Einen schönen Tag noch.',
    zahvala: 'Gern geschehen.',
    nimamPonoviti: 'Es gibt nichts zu wiederholen.',
    shranjeno: 'Gespeichert.',
    niUspelo: 'Das hat nicht geklappt. Es wurde nichts geändert.',
    preklicanoZaslon: 'Abgebrochen. Es wurde nichts geändert.',
    preklicanoGovor: 'Gut, abgebrochen.',
    nekajNiSlo: 'Etwas ist schiefgelaufen.',
    namigi: ['Moment.', 'Einen Augenblick.', 'Ich schaue nach.'],
    mikrofon: 'Der Zugriff auf das Mikrofon ist nicht erlaubt. Erlauben Sie das Mikrofon für diese Seite in den Browsereinstellungen.',
    brezMikrofona: 'Dieser Browser unterstützt keine Audioaufnahme.',
    povezava: 'Die Verbindung ist fehlgeschlagen. Es wurde nichts geändert. Bitte versuchen Sie es erneut.',
    razpoznava: 'Die Spracherkennung wurde unterbrochen. Tippen Sie auf die Schaltfläche für ein neues Gespräch.',
    casovna: 'Der Assistent hat nicht rechtzeitig geantwortet. Es wurde nichts geändert.',
    nerazumljiv: 'Ungültige Serverantwort. Es wurde nichts geändert.',
    poslano: "Gesendet.",
    zaprto: "Gut, geschlossen. Es wurde nichts gespeichert.",
    neObvescam: "Gut, ich benachrichtige den Kunden nicht.",
    niShranjeno: "Noch nicht gespeichert.",
    preveri: "Das Formular ist noch nicht gespeichert. Bitte sehen Sie es sich an.",
    uspeh: {
      nov_termin: "Super, der Termin ist eingetragen.",
      prestavi_termin: "Super, der Termin ist verschoben.",
      uredi_termin: "Super, der Termin ist aktualisiert.",
      uredi_stranko: "Super, die Kundendaten sind aktualisiert.",
      odsotnost: "Super, die Abwesenheit ist eingetragen.",
      nova_stranka: "Super, der Kunde ist hinzugefügt.",
    },
  },
  it: {
    konec: 'Va bene. Buona giornata.',
    zahvala: 'Prego.',
    nimamPonoviti: 'Non ho niente da ripetere.',
    shranjeno: 'Salvato.',
    niUspelo: 'Non è riuscito. Non è stato modificato nulla.',
    preklicanoZaslon: 'Annullato. Non è stato modificato nulla.',
    preklicanoGovor: 'Va bene, annullato.',
    nekajNiSlo: 'Qualcosa è andato storto.',
    namigi: ['Un momento.', 'Un attimo.', 'Controllo.'],
    mikrofon: "L'accesso al microfono non è consentito. Consenta il microfono per questo sito nelle impostazioni del browser.",
    brezMikrofona: 'Questo browser non supporta la registrazione audio.',
    povezava: 'La connessione non è riuscita. Non è stato modificato nulla. Riprovi.',
    razpoznava: 'Il riconoscimento vocale si è interrotto. Tocchi il pulsante per una nuova conversazione.',
    casovna: "L'assistente non ha risposto in tempo. Non è stato modificato nulla.",
    nerazumljiv: 'Risposta del server non valida. Non è stato modificato nulla.',
    poslano: "Inviato.",
    zaprto: "Va bene, chiuso. Non è stato salvato nulla.",
    neObvescam: "Va bene, non avviso il cliente.",
    niShranjeno: "Non ancora salvato.",
    preveri: "Il modulo non è ancora salvato. Lo controlli, per favore.",
    uspeh: {
      nov_termin: "Perfetto, l'appuntamento è registrato.",
      prestavi_termin: "Perfetto, l'appuntamento è spostato.",
      uredi_termin: "Perfetto, l'appuntamento è aggiornato.",
      uredi_stranko: "Perfetto, i dati del cliente sono aggiornati.",
      odsotnost: "Perfetto, l'assenza è registrata.",
      nova_stranka: "Perfetto, il cliente è aggiunto.",
    },
  },
  hr: {
    konec: 'U redu. Ugodan dan.',
    zahvala: 'Molim.',
    nimamPonoviti: 'Nemam što ponoviti.',
    shranjeno: 'Spremljeno.',
    niUspelo: 'Nije uspjelo. Ništa nije promijenjeno.',
    preklicanoZaslon: 'Otkazano. Ništa nije promijenjeno.',
    preklicanoGovor: 'U redu, otkazano.',
    nekajNiSlo: 'Nešto nije u redu.',
    namigi: ['Trenutak.', 'Samo malo.', 'Provjeravam.'],
    mikrofon: 'Pristup mikrofonu nije dopušten. Dopustite mikrofon za ovu stranicu u postavkama preglednika.',
    brezMikrofona: 'Ovaj preglednik ne podržava snimanje zvuka.',
    povezava: 'Veza nije uspjela. Ništa nije promijenjeno. Pokušajte ponovno.',
    razpoznava: 'Prepoznavanje govora se prekinulo. Dodirnite gumb za novi razgovor.',
    casovna: 'Asistent nije odgovorio na vrijeme. Ništa nije promijenjeno.',
    nerazumljiv: 'Nevažeći odgovor poslužitelja. Ništa nije promijenjeno.',
    poslano: "Poslano.",
    zaprto: "U redu, zatvoreno. Ništa nije spremljeno.",
    neObvescam: "U redu, ne obavještavam klijenta.",
    niShranjeno: "Još nije spremljeno.",
    preveri: "Obrazac još nije spremljen. Pogledajte ga, molim.",
    uspeh: {
      nov_termin: "Super, termin je upisan.",
      prestavi_termin: "Super, termin je premješten.",
      uredi_termin: "Super, termin je ažuriran.",
      uredi_stranko: "Super, podaci klijenta su ažurirani.",
      odsotnost: "Super, odsutnost je upisana.",
      nova_stranka: "Super, klijent je dodan.",
    },
  },
};

/** Besedila v trenutnem jeziku. */
export function besedila(): BesedilaOdjemalca {
  return BESEDILA[trenutni];
}
