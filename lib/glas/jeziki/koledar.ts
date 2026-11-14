// lib/glas/jeziki/koledar.ts
//
// Datumi, ure, trajanje, števke in e-pošta za glas in zaslon v jezikih en, de, it, hr.
// Slovenščina ostane v lib/glas/govor.ts in razresevanje/datumi.ts (nespremenjena).
// Ure so zapisane s števkami tako, kot jih TTS prebere naravno: "at 2:30 pm",
// "um 14 Uhr 30", "alle 14 e 30", "u 14 i 30".

import type { Jezik } from './jezik';

type Tuj = Exclude<Jezik, 'sl'>;

/** 0 = ponedeljek … 6 = nedelja. */
const DNEVI: Record<Tuj, string[]> = {
  en: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  de: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'],
  it: ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'],
  hr: ['ponedjeljak', 'utorak', 'srijeda', 'četvrtak', 'petak', 'subota', 'nedjelja'],
};
/** Hrvaški tožilnik za "u …" (u srijedu, u subotu, u nedjelju). */
const HR_DAN_TOZILNIK = ['ponedjeljak', 'utorak', 'srijedu', 'četvrtak', 'petak', 'subotu', 'nedjelju'];

const MESECI: Record<Tuj, string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  de: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
  it: ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'],
  // Rodilnik, kot se reče datum: "16. studenoga".
  hr: ['siječnja', 'veljače', 'ožujka', 'travnja', 'svibnja', 'lipnja', 'srpnja', 'kolovoza', 'rujna', 'listopada', 'studenoga', 'prosinca'],
};

const RELATIVNO: Record<Tuj, { danes: string; jutri: string; vceraj: string; pojutri: string }> = {
  en: { danes: 'today', jutri: 'tomorrow', vceraj: 'yesterday', pojutri: 'the day after tomorrow' },
  de: { danes: 'heute', jutri: 'morgen', vceraj: 'gestern', pojutri: 'übermorgen' },
  it: { danes: 'oggi', jutri: 'domani', vceraj: 'ieri', pojutri: 'dopodomani' },
  hr: { danes: 'danas', jutri: 'sutra', vceraj: 'jučer', pojutri: 'prekosutra' },
};

/** Datum za glas, vedno z dnevom v tednu: "tomorrow, Friday", "on Monday, November 16". */
export function datumZaGovorTuj(j: Tuj, dan: number, mesec: number, danVTednu: number, razlika: number): string {
  const r = RELATIVNO[j];
  const ime = DNEVI[j][danVTednu];
  if (razlika === 0) return r.danes;
  const kratko = j === 'hr' ? `u ${HR_DAN_TOZILNIK[danVTednu]}` : ime;
  if (razlika === 1) return `${r.jutri}, ${kratko}`;
  if (razlika === -1) return `${r.vceraj}, ${kratko}`;
  if (razlika === 2) return `${r.pojutri}, ${kratko}`;
  const m = MESECI[j][mesec - 1];
  switch (j) {
    case 'en':
      return `on ${ime}, ${m} ${dan}`;
    case 'de':
      return `am ${ime}, ${dan}. ${m}`;
    case 'it':
      return `${ime} ${dan} ${m}`;
    case 'hr':
      return `u ${HR_DAN_TOZILNIK[danVTednu]}, ${dan}. ${m}`;
  }
}

/** Datum za zaslon: "Friday, 14 Nov" / "Freitag, 14.11." / "venerdì 14/11" / "petak, 14. 11.". */
export function opisDatumaTuj(j: Tuj, dan: number, mesec: number, danVTednu: number, razlika: number): string {
  const ime = DNEVI[j][danVTednu];
  const osnova =
    j === 'en'
      ? `${ime}, ${dan} ${MESECI.en[mesec - 1].slice(0, 3)}`
      : j === 'de'
        ? `${ime}, ${dan}.${mesec}.`
        : j === 'it'
          ? `${ime} ${dan}/${mesec}`
          : `${ime}, ${dan}. ${mesec}.`;
  const r = RELATIVNO[j];
  if (razlika === 0) return `${r.danes}, ${osnova}`;
  if (razlika === 1) return `${r.jutri}, ${osnova}`;
  if (razlika === -1) return `${r.vceraj}, ${osnova}`;
  return osnova;
}

/** Ime dneva (imenovalnik). */
export function imeDneva(j: Tuj, danVTednu: number): string {
  return DNEVI[j][danVTednu];
}

/** Ura brez predloga: "2:30 pm", "14 Uhr 30", "14 e 30", "14 i 30". */
function uraBesedilo(j: Tuj, h: number, min: number): string {
  const mm = String(min).padStart(2, '0');
  switch (j) {
    case 'en': {
      const h12 = h % 12 || 12;
      const del = h < 12 ? 'am' : 'pm';
      if (h === 12 && min === 0) return 'noon';
      return min === 0 ? `${h12} ${del}` : `${h12}:${mm} ${del}`;
    }
    case 'de':
      return min === 0 ? `${h} Uhr` : `${h} Uhr ${min}`;
    case 'it':
      return min === 0 ? `${h}` : min === 30 ? `${h} e mezza` : `${h} e ${min}`;
    case 'hr':
      return min === 0 ? `${h}` : min === 30 ? `${h} i 30` : `${h} i ${min}`;
  }
}

/** Ura s predlogom: "at 2:30 pm", "um 14 Uhr 30", "alle 14 e mezza", "u 14 i 30". */
export function uraZaGovorTuj(j: Tuj, h: number, min: number): string {
  const b = uraBesedilo(j, h, min);
  switch (j) {
    case 'en':
      return b === 'noon' ? 'at noon' : `at ${b}`;
    case 'de':
      return `um ${b}`;
    case 'it':
      return h === 1 ? `all'${b === '1' ? 'una' : b.replace(/^1 /, 'una ')}` : h === 0 ? `a mezzanotte${min ? ` e ${min}` : ''}` : `alle ${b}`;
    case 'hr':
      return `u ${b}`;
  }
}

/** Razpon: "from 9 am to 10:30 am", "von 9 Uhr bis 10 Uhr 30", "dalle 9 alle 10 e mezza", "od 9 do 10 i 30". */
export function razponZaGovorTuj(j: Tuj, od: [number, number], doo: [number, number]): string {
  const a = uraBesedilo(j, od[0], od[1]);
  const b = uraBesedilo(j, doo[0], doo[1]);
  switch (j) {
    case 'en':
      return `from ${a} to ${b}`;
    case 'de':
      return `von ${a} bis ${b}`;
    case 'it':
      return `dalle ${a} alle ${b}`;
    case 'hr':
      return `od ${a} do ${b}`;
  }
}

/** Trajanje: 30 → "half an hour", 90 → "an hour and a half", 150 → "2 hours and 30 minutes". */
export function trajanjeZaGovorTuj(j: Tuj, min: number): string {
  const ur = Math.floor(min / 60);
  const ost = min % 60;
  const T = {
    en: { pol: 'half an hour', ena: 'an hour', ure: (n: number) => `${n} hours`, inPol: (u: string) => `${u} and a half`, min: (n: number) => `${n} minutes`, in: ' and ' },
    de: { pol: 'eine halbe Stunde', ena: 'eine Stunde', ure: (n: number) => `${n} Stunden`, inPol: (u: string) => (u === 'eine Stunde' ? 'anderthalb Stunden' : `${u} und eine halbe`), min: (n: number) => `${n} Minuten`, in: ' und ' },
    it: { pol: "mezz'ora", ena: "un'ora", ure: (n: number) => `${n} ore`, inPol: (u: string) => `${u} e mezza`, min: (n: number) => `${n} minuti`, in: ' e ' },
    hr: { pol: 'pola sata', ena: 'jedan sat', ure: (n: number) => (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? `${n} sata` : `${n} sati`), inPol: (u: string) => `${u} i pol`, min: (n: number) => `${n} minuta`, in: ' i ' },
  }[j];
  if (ur === 0) return ost === 30 ? T.pol : T.min(ost);
  const ure = ur === 1 ? T.ena : T.ure(ur);
  if (ost === 0) return ure;
  if (ost === 30) return T.inPol(ure);
  return `${ure}${T.in}${T.min(ost)}`;
}

export const STEVKE_TUJE: Record<Tuj, string[]> = {
  en: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'],
  de: ['null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun'],
  it: ['zero', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove'],
  hr: ['nula', 'jedan', 'dva', 'tri', 'četiri', 'pet', 'šest', 'sedam', 'osam', 'devet'],
};

/** Besede za znake e-pošte: @ . - _ + */
export const EMAIL_TUJE: Record<Tuj, { afna: string; pika: string; pomisljaj: string; podcrtaj: string; plus: string }> = {
  en: { afna: 'at', pika: 'dot', pomisljaj: 'dash', podcrtaj: 'underscore', plus: 'plus' },
  de: { afna: 'at', pika: 'Punkt', pomisljaj: 'Bindestrich', podcrtaj: 'Unterstrich', plus: 'plus' },
  it: { afna: 'chiocciola', pika: 'punto', pomisljaj: 'trattino', podcrtaj: 'trattino basso', plus: 'più' },
  hr: { afna: 'et', pika: 'točka', pomisljaj: 'crtica', podcrtaj: 'donja crta', plus: 'plus' },
};

/** "ali" med možnostmi. */
export const ALI: Record<Jezik, string> = { sl: 'ali', en: 'or', de: 'oder', it: 'o', hr: 'ili' };

/** Predlog pred uro v besedilu za zaslon (za pretvorbo "at 10:30" → glas). */
export const PREDLOG_URE: Record<Tuj, string> = { en: 'at', de: 'um', it: 'alle', hr: 'u' };
