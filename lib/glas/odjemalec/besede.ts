// lib/glas/odjemalec/besede.ts
//
// Čista logika pogovora v brskalniku (brez DOM-a, zato jo lahko testiramo):
// sestavljanje izjave iz Soniox žetonov, prepoznava "ja/ne" za potrditev,
// izbira med možnostmi po imenu, pretvorba zvoka v 16 kHz PCM.

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
}

const brezLocil = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const DA = new Set(['ja', 'jap', 'ja ja', 'ja prosim', 'potrdi', 'potrdim', 'potrjujem', 'seveda', 'lahko', 'v redu', 'ok', 'okej', 'ja potrdi', 'ja lahko', 'ja shrani', 'shrani', 'ja v redu', 'kar', 'ja kar']);
const NE = new Set(['ne', 'nee', 'ne hvala', 'preklici', 'prekliči', 'stop', 'ne ne', 'pusti', 'ni treba', 'ne zapisi', 'ne shrani', 'odpovej']);

/**
 * Ali je izjava kratka potrditev ("ja", "potrdi"). Samo cela kratka izjava:
 * "ja, ampak spremeni na 7.1" NI potrditev (gre nazaj asistentu kot nov ukaz).
 */
export function jePotrditev(izjava: string): boolean {
  const s = brezLocil(izjava);
  return DA.has(s) || DA.has(s.replace(/ hvala$/, ''));
}

export function jeZavrnitev(izjava: string): boolean {
  const s = brezLocil(izjava);
  return NE.has(s) || NE.has(brezLocil(s));
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
