// lib/glas/razresevanje/besedilo.ts
//
// Normalizacija slovenskega govora po prepisu: male črke, brez šumnikov za
// primerjavo, ločila stran, števila z besedo. Uporablja se za fuzzy ujemanje
// imen in za hitro pot brez LLM.

const SUMNIKI: Record<string, string> = { č: 'c', ć: 'c', š: 's', ž: 'z', đ: 'd' };

/** "Ána  Novak-Kranjc," → "ana novak kranjc" (šumniki ohranjeni) */
export function poenostavi(besedilo: string): string {
  return besedilo
    .toLowerCase()
    .normalize('NFC')
    .replace(/[̀-́̂]/g, '')
    .replace(/[^\p{L}\p{N}\s.:%]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Brez šumnikov in naglasov: "Žnidaršič" → "znidarsic" */
export function brezSumnikov(besedilo: string): string {
  return besedilo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[čćšžđ]/g, (c) => SUMNIKI[c] ?? c);
}

/** Ključ za primerjavo imen: brez šumnikov, samo črke. */
export function kljuc(besedilo: string): string {
  return brezSumnikov(besedilo).replace(/[^a-z]/g, '');
}

// Končnice slovenskih sklanjatev (od najdaljše), za samostalnike in imena.
// "Novakovi" → "novak", "Ani" → "an", "Anji" → "anj", "Petru" → "petr".
const KONCNICE = [
  'ovem', 'evem', 'ovim', 'evim', 'ovih', 'evih', 'ovega', 'evega', 'ovemu', 'evemu',
  'ova', 'eva', 'ovi', 'evi', 'ovo', 'evo', 'ove', 'eve',
  'ijo', 'ija', 'iji', 'ije',
  'om', 'em', 'jo', 'ja', 'ji', 'je', 'ju', 'ih', 'im', 'mi',
  'a', 'e', 'i', 'o', 'u',
];

/** Možne osnove besede (besedilo že brez šumnikov). Vključno z besedo samo. */
export function osnove(beseda: string): string[] {
  const b = kljuc(beseda);
  const rezultat = new Set<string>([b]);
  for (const k of KONCNICE) {
    // Ostati morata vsaj 2 črki ("Ani" → "an"), sicer bi se vse ujemalo z vsem.
    if (b.length - k.length >= 2 && b.endsWith(k)) rezultat.add(b.slice(0, -k.length));
  }
  return [...rezultat];
}

const ENICE: Record<string, number> = {
  nic: 0, ena: 1, en: 1, eno: 1, prvi: 1, dva: 2, dve: 2, tri: 3, stiri: 4, pet: 5, sest: 6,
  sedem: 7, osem: 8, devet: 9, deset: 10, enajst: 11, dvanajst: 12, trinajst: 13,
  stirinajst: 14, petnajst: 15, sestnajst: 16, sedemnajst: 17, osemnajst: 18, devetnajst: 19,
};
const DESETICE: Record<string, number> = {
  dvajset: 20, trideset: 30, stirideset: 40, petdeset: 50, sestdeset: 60,
};

/** "petintrideset" → 35, "trideset" → 30, "sedem" → 7, sicer null. */
export function besedaVStevilo(beseda: string): number | null {
  const b = brezSumnikov(beseda);
  if (/^\d+$/.test(b)) return Number(b);
  if (b in ENICE) return ENICE[b];
  if (b in DESETICE) return DESETICE[b];
  const m = b.match(/^(ena|en|dva|dve|tri|stiri|pet|sest|sedem|osem|devet)in(dvajset|trideset|stirideset|petdeset)$/);
  if (m) return (ENICE[m[1]] ?? 0) + (DESETICE[m[2]] ?? 0);
  return null;
}
