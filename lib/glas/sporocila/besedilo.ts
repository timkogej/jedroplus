// lib/glas/sporocila/besedilo.ts
//
// Besedilo sporočila stranki (»sporoči stranki«): čiščenje za SMS, dolžina,
// podpis in zavrnitev ponudb. Čiste funkcije, brez dostopa do baze.
//
// Obvestilo o terminu je storitveno sporočilo, zato ne zahteva marketinške
// privolitve. Pošteno ga drži to, da strežnik zavrne vse, kar je videti kot
// ponudba (popust, cena, povezava, tuja številka) — v vseh petih jezikih.

/** En SMS brez šumnikov (BulkGate, unicode:false). */
export const NAJVEC_SMS = 160;
export const NAJVEC_EMAIL = 1000;

/**
 * Isto kot `ocisti` v n8n podtoku »sms-send (Jedro+)«: brez šumnikov in posebnih
 * znakov, ena vrstica. Kar pokažemo v predogledu, je točno to, kar gre ven.
 */
export function ocistiSms(t: string): string {
  const ZAM: Record<string, string> = {
    ä: 'ae', ö: 'oe', ü: 'ue', Ä: 'Ae', Ö: 'Oe', Ü: 'Ue', ß: 'ss', đ: 'd', Đ: 'D', ł: 'l', Ł: 'L', ø: 'o', Ø: 'O', æ: 'ae', œ: 'oe',
  };
  let x = String(t ?? '').replace(/https?:\/\//gi, '');
  x = x.replace(/[äöüÄÖÜßđĐłŁøØæœ]/g, (c) => ZAM[c]);
  x = x.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  x = x
    .replace(/[\u2018\u2019\u201a\u2032`\u00b4]/g, "'")
    .replace(/[\u201c\u201d\u201e\u2033"\u00ab\u00bb]/g, '')
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/\u2026/g, '...')
    .split('\\').join('/')
    .replace(/[\r\n\t]+/g, ' ');
  x = x.replace(/[^\x20-\x7E]/g, ' ');
  return x.replace(/\s{2,}/g, ' ').replace(/\s+([,.!?])/g, '$1').trim();
}

/** Besedilo + podpis salona (podpis doda strežnik, ne model). */
export function zPodpisom(besedilo: string, podpis: string): string {
  const b = besedilo.trim();
  const p = podpis.trim();
  if (!p || b.toLowerCase().includes(p.toLowerCase())) return b;
  return `${/[.!?]$/.test(b) ? b : `${b}.`} ${p}`;
}

// Ponudbe in oglaševanje (sl, en, de, it, hr). Primerja se brez šumnikov in z malimi črkami.
const PONUDBE: RegExp[] = [
  /%|€|\$|\beur(o|ov|a)?\b|\bkn\b/,
  /https?:|www\.|\b[a-z0-9-]+\.(si|com|net|org|eu|hr|it|de|at|io|ly)\b/,
  // sl / hr
  /popust|akcij|gratis|brezplacn|besplatn|ponudb|ponuda\b|kupon|znizan|snizen|novo pri nas|novost/,
  // en
  /discount|\bpromo|\bsale\b|special offer|\bfree\b|coupon|voucher|\bdeal\b|% off|new at our/,
  // de
  /rabatt|angebot|kostenlos|gutschein|\baktion|sonderpreis|neu bei uns/,
  // it
  /sconto|offerta|gratuit|\bpromozion|\bsaldi\b|novita/,
];

/** Telefonska številka (vsaj 7 števk skupaj); salon jo da sam v podpisu, model ne. */
const TELEFON = /(?:\+|\b)\d[\d\s/.-]{5,}\d\b/;

export type RazlogZavrnitve = 'ponudba' | 'telefon' | 'prazno';

/** Ali besedilo sme iti stranki kot obvestilo o terminu. */
export function preveriBesedilo(besedilo: string): RazlogZavrnitve | null {
  const b = besedilo.trim();
  if (!b) return 'prazno';
  const x = b.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (PONUDBE.some((r) => r.test(x))) return 'ponudba';
  // Števke iz datumov in ur ("16. 11.", "10:30", "15 minut") ne štejejo.
  const brezCasov = x.replace(/\b\d{1,2}[:.]\d{2}\b/g, ' ').replace(/\b\d{1,2}\.\s?\d{1,2}\.(\s?\d{4})?/g, ' ');
  if (TELEFON.test(brezCasov) && brezCasov.replace(/\D/g, '').length >= 7) return 'telefon';
  return null;
}

/** Skrije sredino telefona za zaslon: "040 … 456". */
export function skritTelefon(telefon: string): string {
  const s = telefon.replace(/[^\d+]/g, '');
  if (s.length < 6) return '…';
  return `${s.slice(0, s.startsWith('+') ? 4 : 3)} … ${s.slice(-3)}`;
}

/** Skrije e-naslov za zaslon: "a…@gmail.com". */
export function skritEmail(email: string): string {
  const [ime, domena] = email.split('@');
  if (!ime || !domena) return '…';
  return `${ime[0]}…@${domena}`;
}
