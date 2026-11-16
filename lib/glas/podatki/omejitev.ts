// lib/glas/podatki/omejitev.ts
//
// Zaposleni, ki po nastavitvi (staff_role_permissions.past_appointments_days)
// ne sme videti starih terminov, jih ne sme slišati niti od asistenta.
// null/manjka = vse, 0 = od danes naprej, N = od danes minus N dni.
// Velja samo za vlogo staff; lastnik in admin vidita vse (isto kot v vmesniku).

import type { Kontekst, PodatkiSalona } from '../tipi';

/** Prvi dan (yyyy-MM-dd), ki ga zaposleni še sme videti; null = brez omejitve. */
export function mejaStarihTerminov(k: Pick<Kontekst, 'vloga' | 'pravice' | 'casovniPas' | 'zdaj'>): string | null {
  if (k.vloga !== 'staff') return null;
  const dni = (k.pravice as { past_appointments_days?: unknown } | null)?.past_appointments_days;
  if (typeof dni !== 'number' || !Number.isInteger(dni) || dni < 0) return null;
  let danes: string;
  try {
    danes = new Intl.DateTimeFormat('en-CA', { timeZone: k.casovniPas, year: 'numeric', month: '2-digit', day: '2-digit' }).format(k.zdaj);
  } catch {
    danes = k.zdaj.toISOString().slice(0, 10);
  }
  const d = new Date(`${danes}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dni);
  return d.toISOString().slice(0, 10);
}

export function zOmejitvijoStarih(podatki: PodatkiSalona, k: Kontekst): PodatkiSalona {
  const meja = mejaStarihTerminov(k);
  if (!meja) return podatki;
  const od = (d: string) => (d < meja ? meja : d);
  return {
    ...podatki,
    termini: async (a, b, m) => (b < meja ? [] : podatki.termini(od(a), b, m)),
    zgodovinaTerminov: async (a, b) => (b < meja ? [] : podatki.zgodovinaTerminov(od(a), b)),
    zadnjiTermin: async (id, pred) => {
      const t = await podatki.zadnjiTermin(id, pred);
      return t && t.datum >= meja ? t : null;
    },
    naslednjiTermin: (id, odDatuma) => podatki.naslednjiTermin(id, od(odDatuma)),
  };
}
