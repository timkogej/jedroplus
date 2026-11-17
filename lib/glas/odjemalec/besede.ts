// lib/glas/odjemalec/besede.ts
//
// Čista logika pogovora v brskalniku (brez DOM-a, zato jo lahko testiramo):
// sestavljanje izjave iz Soniox žetonov, prepoznava "ja/ne" za potrditev,
// izbira med možnostmi po imenu, pretvorba zvoka v 16 kHz PCM.

import { BESEDE, jezikOdjemalca } from './jezikOdjemalca';

/** Žeton sprotnega Soniox STT (podmnožica polj, ki jih rabimo). */
export interface SonioxZeton {
  text: string;
  is_final?: boolean;
  start_ms?: number;
  end_ms?: number;
}

/**
 * Sestavi izjave iz Soniox sporočil. Končni žetoni pridejo enkrat, delni se v vsakem
 * sporočilu ponovijo (zamenjajo prejšnje). `<end>` = Soniox je zaznal konec govora.
 */
export class SestavljalecIzjave {
  private koncno = '';
  private delno = '';

  /** Vrne izjavo, ko je zaznan konec govora (sicer null). */
  dodaj(zetoni: SonioxZeton[]): { izjava: string | null; imaGovor: boolean } {
    let konec = false;
    let delno = '';
    for (const z of zetoni) {
      if (z.text === '<end>') {
        if (z.is_final) konec = true;
        continue;
      }
      if (z.is_final) this.koncno += z.text;
      else delno += z.text;
    }
    this.delno = delno;
    const imaGovor = /\p{L}/u.test(delno) || zetoni.some((z) => z.is_final && z.text !== '<end>' && /\p{L}/u.test(z.text));
    if (!konec) return { izjava: null, imaGovor };
    const izjava = this.koncno.replace(/\s+/g, ' ').trim();
    this.koncno = '';
    return { izjava: izjava || null, imaGovor };
  }

  /** Kar je bilo slišano doslej (za sproten prikaz). */
  get trenutno(): string {
    return `${this.koncno}${this.delno}`.replace(/\s+/g, ' ').trim();
  }

  pocisti() {
    this.koncno = '';
    this.delno = '';
  }

  /** Začne z danim besedilom (npr. besede, s katerimi je uporabnik prekinil asistenta). */
  nastavi(besedilo: string) {
    this.koncno = besedilo ? `${besedilo} ` : '';
    this.delno = '';
  }
}

const brezLocil = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    // "don't", "d'accordo", "potvrđujem", "schließen" → kot v seznamih besed
    .replace(/['’`]/g, '')
    .replace(/đ/g, 'd')
    .replace(/ß/g, 'ss')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const DA_SL = new Set(['ja', 'jap', 'ja ja', 'ja prosim', 'potrdi', 'potrdim', 'potrjujem', 'seveda', 'lahko', 'v redu', 'ok', 'okej', 'ja potrdi', 'ja lahko', 'ja shrani', 'shrani', 'ja v redu', 'kar', 'ja kar', 'da', 'da prosim', 'da potrdi', 'da shrani', 'poslji', 'ja poslji', 'da poslji', 'poslji ga', 'poslji jo', 'ja poslji ga', 'ja poslji jo', 'kar poslji', 'lahko poslji', 'ja lahko poslji', 'posljem', 'posljite', 'ja posljite', 'ja seveda', 'ja ok', 'ja okej', 'super', 'ja super', 'tocno', 'drzi', 'ja drzi', 'prav', 'ja ja ja', 'mhm', 'ja hvala', 'ja lahko ja', 'gremo', 'ja gremo', 'dajmo', 'ja dajmo', 'vredu', 'ja vredu']);
const NE_SL = new Set(['ne', 'nee', 'ne hvala', 'preklici', 'prekliči', 'stop', 'ne ne', 'pusti', 'ni treba', 'ne zapisi', 'ne shrani', 'odpovej', 'ne poslji', 'ne posiljaj', 'ne posiljajte', 'ne posljite', 'nikar', 'ne ne ne', 'ne zdaj', 'ne se', 'ustavi', 'raje ne', 'ne bo treba', 'ne rabim', 'ne ne poslji', 'ne hvala ne', 'ne bomo', 'pozabi']);

// Slovenščina po besedah (Tim, 17. 11.: »A ja, lahko, pošljem, ja.« in »Ja, shrani, super.« nista
// bila potrditev). Potrditev = vsaka beseda je potrditvena ali mašilo, vsaj ena je prava potrditev
// in nobena ni zanikanje. »Ja, ampak spremeni na 7.1« ima vsebino → ostane nov ukaz.
const DA_BESEDE_SL = new Set(['ja', 'jap', 'jaa', 'jep', 'da', 'potrdi', 'potrdim', 'potrjujem', 'potrdite', 'seveda', 'lahko', 'ok', 'okej', 'okay', 'oke', 'vredu', 'uredu', 'shrani', 'shranite', 'shranim', 'poslji', 'posljite', 'posljem', 'posljes', 'super', 'odlicno', 'tocno', 'drzi', 'prav', 'mhm', 'gremo', 'dajmo', 'daj', 'dajte', 'tako', 'ustreza', 'velja', 'vpisi', 'vpisite', 'zapisi', 'zapisite', 'naredi', 'izvedi', 'perfektno', 'fajn', 'kul', 'sevede']);
const MASILA_SL = new Set(['a', 'no', 'pa', 'e', 'ee', 'eee', 'em', 'am', 'hm', 'hmm', 'ah', 'aha', 'ga', 'jo', 'to', 'tako', 'kar', 'kr', 'prosim', 'hvala', 'lepo', 'zdaj', 'zdej', 'sedaj', 'v', 'redu', 'mi', 'ti', 'se', 'vse', 'samo', 'cisto', 'res', 'pac', 'ane']);
const NE_BESEDE_SL = new Set(['ne', 'nee', 'nikar', 'stop', 'preklici', 'preklicite', 'pusti', 'pustite', 'ustavi', 'pozabi', 'odpovej', 'nocem', 'noceva', 'nocemo']);
// Besede, ki smejo stati ob zanikanju (»ne, ne pošiljaj ga«, »ne, ni treba, hvala«).
const OB_NE_SL = new Set(['poslji', 'posiljaj', 'posiljajte', 'posljite', 'shrani', 'shranjuj', 'zapisi', 'zapisuj', 'vpisi', 'ni', 'treba', 'rabim', 'rabimo', 'bo', 'bomo', 'raje', 'zdaj', 'zdej', 'se', 'tega', 'ga', 'jo', 'to', 'hvala', 'prosim', 'a', 'no', 'pa', 'e', 'ee', 'em', 'am', 'hm', 'ah', 'kar', 'potrebno']);

function potrditevPoBesedah(s: string): boolean {
  const b = s.split(' ').filter(Boolean);
  if (b.length === 0 || b.length > 8) return false;
  if (b.some((x) => NE_BESEDE_SL.has(x))) return false;
  return b.every((x) => DA_BESEDE_SL.has(x) || MASILA_SL.has(x)) && b.some((x) => DA_BESEDE_SL.has(x));
}

function zavrnitevPoBesedah(s: string): boolean {
  const b = s.split(' ').filter(Boolean);
  if (b.length === 0 || b.length > 8) return false;
  return b.some((x) => NE_BESEDE_SL.has(x)) && b.every((x) => NE_BESEDE_SL.has(x) || OB_NE_SL.has(x));
}

// Drugi jeziki (jezik pogovora iz seje); množice se zgradijo enkrat.
const ZA_JEZIK = new Map<string, { da: Set<string>; ne: Set<string> }>();
function dane(): { da: Set<string>; ne: Set<string> } {
  const j = jezikOdjemalca();
  if (j === 'sl') return { da: DA_SL, ne: NE_SL };
  let m = ZA_JEZIK.get(j);
  if (!m) {
    m = { da: new Set(BESEDE[j].da), ne: new Set(BESEDE[j].ne) };
    ZA_JEZIK.set(j, m);
  }
  return m;
}

/**
 * Ali je izjava kratka potrditev ("ja", "potrdi"). Samo cela kratka izjava:
 * "ja, ampak spremeni na 7.1" NI potrditev (gre nazaj asistentu kot nov ukaz).
 */
export function jePotrditev(izjava: string): boolean {
  const s = brezLocil(izjava);
  const { da } = dane();
  const brezHvala = s.replace(/ (hvala|thanks|thank you|danke|grazie)$/, '');
  // "Ja, pošlji ga" / "Ja, schick es": uvodni "ja" pred drugo potrditvijo.
  if (da.has(s) || da.has(brezHvala) || da.has(brezHvala.replace(/^(ja|da|yes|si|ok|okej|okay) /, ''))) return true;
  return jezikOdjemalca() === 'sl' && potrditevPoBesedah(s);
}

export function jeZavrnitev(izjava: string): boolean {
  const s = brezLocil(izjava);
  const { ne } = dane();
  // "Ne, ne pošiljaj" / "No, don't send": uvodni "ne" pred drugo zavrnitvijo.
  if (ne.has(s) || ne.has(s.replace(/^(ne|no|nein) /, ''))) return true;
  return jezikOdjemalca() === 'sl' && zavrnitevPoBesedah(s);
}

/** Uporabnik je izgovoril ime ene od možnosti ("Ano Novak") → ta možnost; sicer null. */
export function izberiMoznost<T extends { id: string; oznaka: string }>(izjava: string, moznosti: T[]): T | null {
  const besede = brezLocil(izjava).split(' ');
  const ustreza = moznosti.filter((m) => {
    const ime = brezLocil(m.oznaka.replace(/\([^)]*\)/g, '')).split(' ').filter(Boolean);
    return ime.length > 0 && ime.every((del) => {
      const koren = del.length > 4 ? del.slice(0, del.length - 2) : del.slice(0, Math.max(2, del.length - 1));
      return besede.some((b) => b.startsWith(koren));
    });
  });
  if (ustreza.length <= 1) return ustreza[0] ?? null;
  // Več ujemanj po korenu (Novak/Novinc): odloči število besed, izgovorjenih točno.
  const tocno = (m: T) => brezLocil(m.oznaka.replace(/\([^)]*\)/g, '')).split(' ').filter((del) => besede.includes(del)).length;
  const tocke = ustreza.map(tocno);
  const naj = Math.max(...tocke);
  return tocke.filter((t) => t === naj).length === 1 ? ustreza[tocke.indexOf(naj)] : null;
}

/**
 * Zmanjša vzorčenje na 16 kHz (povprečje okna kot preprost nizkoprepustni filter)
 * in pretvori v 16-bitni PCM. Ista logika je v public/glas/mikrofon-worklet.js.
 */
export function v16kPcm(vhod: Float32Array, izvorHz: number): Int16Array {
  const razmerje = izvorHz / 16000;
  const n = Math.floor(vhod.length / razmerje);
  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const od = Math.floor(i * razmerje);
    const doo = Math.min(vhod.length, Math.floor((i + 1) * razmerje));
    let vsota = 0;
    for (let j = od; j < doo; j++) vsota += vhod[j];
    const v = Math.max(-1, Math.min(1, vsota / Math.max(1, doo - od)));
    out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  return out;
}

/** 16-bitni PCM (little endian) → Float32 za predvajanje. */
export function pcmVFloat(bajti: Uint8Array): Float32Array {
  const n = Math.floor(bajti.length / 2);
  const out = new Float32Array(n);
  const dv = new DataView(bajti.buffer, bajti.byteOffset, n * 2);
  for (let i = 0; i < n; i++) out[i] = dv.getInt16(i * 2, true) / 0x8000;
  return out;
}
