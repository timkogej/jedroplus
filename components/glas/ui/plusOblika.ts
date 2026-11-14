/**
 * Asistent+ v obliki plusa — geometrija.
 *
 * Plus je unija dveh zaobljenih palic (vodoravne in navpične). Ko se palici
 * odebelita, skrajšata in zaoblita do iste mere R, sta obe isti krog: plus se
 * zvezno "napihne" v krog in nazaj, brez preskoka.
 *
 * Oblika je zvezdasta glede na središče (obe palici vsebujeta središče), zato jo
 * zapišemo kot r(θ) = max(palica_v(θ), palica_n(θ)) in vzorčimo po kotih. Notranji
 * koti so zmehčani z gladkim maksimumom (k), ki ob napihnjenosti pade na 0.
 *
 * Vse je v koordinatah 144 × 144 (ORB_OSNOVA), središče 72, 72. Pot gre v CSS
 * clip-path: path(...) in v SVG (rob).
 */

export const OSNOVA = 144;
const S = OSNOVA / 2;

export type RazlicicaPlusa = 'logo' | 'mehak' | 'zele';
export type OblikaOrba = 'krog' | RazlicicaPlusa;
export const OBLIKE: OblikaOrba[] = ['krog', 'logo', 'mehak', 'zele'];

export interface NastavitevPlusa {
  /** Dolžina kraka od središča (mirovanje). */
  krak: number;
  /** Polovična debelina kraka. */
  debelina: number;
  /** Zunanji zaobljeni koti. */
  zaobljenost: number;
  /** Mehčanje notranjih kotov. */
  mehcanje: number;
  /** Polmer kroga, ko je plus povsem napihnjen. */
  krog: number;
  /** Kako daleč proti krogu gre ob najglasnejšem glasu (0–1). */
  napihGlas: number;
  /** Koliko kraki dihajo vsak zase ob glasu (delež dolžine kraka). */
  nesimetrija: number;
}

export const NASTAVITVE: Record<RazlicicaPlusa, NastavitevPlusa> = {
  // Razmerja logotipa (krak 23 %, koti 9 %): tanjši, prepoznaven plus.
  logo: { krak: 64, debelina: 16, zaobljenost: 11, mehcanje: 5, krog: 54, napihGlas: 0.62, nesimetrija: 0.1 },
  // Debelejši, mehkejši plus: berljiv tudi v 48 px.
  mehak: { krak: 62, debelina: 22, zaobljenost: 16, mehcanje: 12, krog: 56, napihGlas: 0.7, nesimetrija: 0.13 },
  // Žele: zaobljeni kraki, močno napihovanje, kraki dihajo vsak zase.
  zele: { krak: 60, debelina: 25, zaobljenost: 24, mehcanje: 18, krog: 58, napihGlas: 0.92, nesimetrija: 0.2 },
};

export interface Kraki {
  gor: number;
  desno: number;
  dol: number;
  levo: number;
}

export interface ParametriPlusa {
  /** Dolžina vsakega kraka od središča. */
  kraki: Kraki;
  debelina: number;
  zaobljenost: number;
  mehcanje: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Parametri oblike iz nastavitve.
 * @param napih 0 = plus, 1 = krog
 * @param raztezki dodatna dolžina posameznega kraka (delež, npr. 0.1 = +10 %)
 */
export function parametri(n: NastavitevPlusa, napih: number, raztezki: Kraki = { gor: 0, desno: 0, dol: 0, levo: 0 }): ParametriPlusa {
  const m = Math.min(1, Math.max(0, napih));
  const krak = (r: number) => lerp(n.krak * (1 + r), n.krog, m);
  const debelina = lerp(n.debelina, n.krog, m);
  return {
    kraki: { gor: krak(raztezki.gor), desno: krak(raztezki.desno), dol: krak(raztezki.dol), levo: krak(raztezki.levo) },
    debelina,
    zaobljenost: Math.min(debelina, lerp(n.zaobljenost, n.krog, m)),
    mehcanje: n.mehcanje * (1 - m),
  };
}

/** Razdalja od središča do roba zaobljenega pravokotnika v smeri (dx, dy) ≥ 0 (en kvadrant). */
function zarek(dx: number, dy: number, ex: number, ey: number, rad: number): number {
  const r = Math.max(0, Math.min(rad, ex, ey));
  const tx = dx > 1e-9 ? ex / dx : Infinity;
  const ty = dy > 1e-9 ? ey / dy : Infinity;
  if (tx <= ty) {
    if (tx * dy <= ey - r) return tx;
  } else if (ty * dx <= ex - r) {
    return ty;
  }
  // Zaobljen kot: krog s središčem (ex − r, ey − r).
  const cx = ex - r;
  const cy = ey - r;
  const b = dx * cx + dy * cy;
  const c = cx * cx + cy * cy - r * r;
  return b + Math.sqrt(Math.max(0, b * b - c));
}

/** Gladki maksimum (zmehča notranje kote). */
function gladkiMax(a: number, b: number, k: number): number {
  if (k <= 0) return Math.max(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + (h * h * k) / 4;
}

/** Polmer oblike v smeri kota (y raste navzdol, 0 = desno). */
export function polmer(p: ParametriPlusa, kot: number): number {
  const dx = Math.cos(kot);
  const dy = Math.sin(kot);
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const vodoravna = zarek(ax, ay, dx >= 0 ? p.kraki.desno : p.kraki.levo, p.debelina, p.zaobljenost);
  const navpicna = zarek(ax, ay, p.debelina, dy >= 0 ? p.kraki.dol : p.kraki.gor, p.zaobljenost);
  return gladkiMax(vodoravna, navpicna, p.mehcanje);
}

/** SVG/CSS pot oblike (zaprt mnogokotnik z gostim vzorčenjem). */
export function potPlusa(p: ParametriPlusa, tock = 168): string {
  let d = '';
  for (let i = 0; i < tock; i++) {
    const kot = (i / tock) * Math.PI * 2;
    const r = polmer(p, kot);
    const x = S + Math.cos(kot) * r;
    const y = S + Math.sin(kot) * r;
    d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return `${d}Z`;
}
