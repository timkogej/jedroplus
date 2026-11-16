// lib/glas/odjemalec/polozaj.ts
//
// Kje je krogec Asistent+ (čista funkcija, tests/glas/polozaj.test.ts):
//   * kot     — v mirovanju spodaj desno;
//   * sredina — med pogovorom na sredini zaslona ("način pogovora");
//   * obrazec — ob obrazcu, ki ga je odprl asistent: v zgornjem levem kotu lista,
//               nad njim, če je prostor (ne prekrije polj ne gumba Shrani).

export type NacinKrogca = 'kot' | 'sredina' | 'obrazec';

export interface Okno {
  w: number;
  h: number;
  /** Varni robovi (iPhone: zareza, domača vrstica). */
  zgoraj: number;
  spodaj: number;
}

export interface Pravokotnik {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Polozaj {
  x: number;
  y: number;
  velikost: number;
}

export const VELIKOST = { kot: 56, sredina: 88, obrazec: 40 } as const;

export function polozajKrogca(nacin: NacinKrogca, okno: Okno, panel?: Pravokotnik | null): Polozaj {
  const rob = okno.w >= 640 ? 24 : 16;
  if (nacin === 'sredina') {
    const v = VELIKOST.sredina;
    // Malo nad sredino: pod krogcem je prostor za napise in kartice.
    return { x: Math.round((okno.w - v) / 2), y: Math.round(Math.max(okno.zgoraj + 24, okno.h * 0.3 - v / 2)), velikost: v };
  }
  if (nacin === 'obrazec' && panel) {
    const v = VELIKOST.obrazec;
    const nad = panel.top - v - 8;
    const x = Math.round(Math.min(Math.max(8, panel.left + 8), okno.w - v - 8));
    // Nad listom, poravnan z levim robom.
    if (nad >= okno.zgoraj + 4) return { x, y: Math.round(nad), velikost: v };
    // List sega do vrha: na sam kot (polovica zunaj lista, če je prostor levo).
    return {
      x: Math.round(Math.max(6, panel.left - v / 3)),
      y: Math.round(Math.max(okno.zgoraj + 6, panel.top - v / 3)),
      velikost: v,
    };
  }
  const v = VELIKOST.kot;
  return { x: okno.w - v - rob, y: okno.h - v - rob - okno.spodaj, velikost: v };
}
