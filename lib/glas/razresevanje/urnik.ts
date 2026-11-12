// lib/glas/razresevanje/urnik.ts
//
// Okviren izračun prvega prostega termina za glasovni odgovor ("kdaj je prvi
// prosti termin za barvanje"). Upošteva delovni čas osebe (ali podjetja),
// izmenične urnike, obstoječe termine te osebe in odsotnosti.
//
// NE upošteva (zato je odgovor označen kot okviren in se termin v fazi 2 ne
// ustvari brez preverjanja v koledarju): zasedenosti resursov, dogodkov z
// onemogočeno rezervacijo, bufferjev med termini, pravil spletne rezervacije.

import { getUrnikZaDan } from '@/lib/utils/urnik';
import { URNIK_DAYS, type UrnikData, type IzmenicenUrnik } from '@/types/resursi';
import type { OdsotnostPovzetek, TerminPovzetek } from '../tipi';
import { dodajDni, danVTednu, izMinut, vMinute, zdajVPasu } from './datumi';

export interface OsebaZaUrnik {
  id: string;
  /** Urnik, ki velja za osebo (lasten ali podjetja). null = ne dela. */
  urnik: UrnikData | IzmenicenUrnik | null;
}

export interface IskanjeProstega {
  odDatuma: string;
  /** Na dan `odDatuma` ne pred to uro (HH:MM). */
  odUre: string | null;
  dni: number;
  trajanjeMin: number;
  osebe: OsebaZaUrnik[];
  termini: TerminPovzetek[];
  odsotnosti: OdsotnostPovzetek[];
  casovniPas: string;
  korakMin?: number;
}

export interface ProstTermin {
  datum: string;
  zacetek: string;
  konec: string;
  osebaId: string;
}

/** Razčleni urnik iz baze (JSON v besedilu ali objekt). */
export function razcleniUrnik(surovo: unknown): UrnikData | IzmenicenUrnik | null {
  if (!surovo) return null;
  let v: unknown = surovo;
  if (typeof surovo === 'string') {
    try {
      v = JSON.parse(surovo);
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if ('vzorci' in o && 'cikel_tednov' in o) return o as unknown as IzmenicenUrnik;
  if (URNIK_DAYS.some((d) => d in o)) return vIntervale(o);
  return null;
}

/** Starejši format osebe {Ponedeljek: {enabled, start, end}} → {enabled, intervals}. */
function vIntervale(o: Record<string, unknown>): UrnikData {
  const out: Record<string, { enabled: boolean; intervals: { start: string; end: string }[] }> = {};
  for (const d of URNIK_DAYS) {
    const dan = (o[d] ?? null) as { enabled?: boolean; start?: string; end?: string; intervals?: { start: string; end: string }[] } | null;
    if (!dan) {
      out[d] = { enabled: false, intervals: [] };
    } else if (Array.isArray(dan.intervals)) {
      out[d] = { enabled: Boolean(dan.enabled), intervals: dan.intervals };
    } else if (dan.start && dan.end) {
      out[d] = { enabled: Boolean(dan.enabled), intervals: [{ start: dan.start, end: dan.end }] };
    } else {
      out[d] = { enabled: false, intervals: [] };
    }
  }
  return out as unknown as UrnikData;
}

/** Delovni intervali osebe na dan, v minutah. */
export function delovniIntervali(urnik: UrnikData | IzmenicenUrnik | null, datum: string): [number, number][] {
  if (!urnik) return [];
  const [l, m, d] = datum.split('-').map(Number);
  const zaDan = getUrnikZaDan(urnik, new Date(l, m - 1, d));
  const dan = zaDan[URNIK_DAYS[danVTednu(datum)]];
  if (!dan?.enabled) return [];
  return (dan.intervals ?? [])
    .map((i) => [vMinute(i.start), vMinute(i.end)] as [number, number])
    .filter(([a, b]) => b > a);
}

function zasedeno(
  osebaId: string,
  datum: string,
  termini: TerminPovzetek[],
  odsotnosti: OdsotnostPovzetek[],
  casovniPas: string
): [number, number][] {
  const out: [number, number][] = [];
  for (const t of termini) {
    if (t.datum !== datum || t.osebaId !== osebaId) continue;
    if (t.status === 'cancelled' || t.status === 'no_show') continue;
    const z = vMinute(t.zacetek);
    // Brez konca privzamemo 60 min (redko; konservativno).
    const k = t.konec ? vMinute(t.konec) : z + 60;
    out.push([z, Math.max(k, z + 1)]);
  }
  for (const o of odsotnosti) {
    if (o.osebaId && o.osebaId !== osebaId) continue;
    const zac = zdajVPasu(new Date(o.zacetek), casovniPas);
    const kon = zdajVPasu(new Date(o.konec), casovniPas);
    if (kon.datum < datum || zac.datum > datum) continue;
    const z = zac.datum < datum ? 0 : vMinute(zac.ura);
    const k = kon.datum > datum ? 24 * 60 : vMinute(kon.ura);
    out.push([z, k]);
  }
  return out;
}

/** Prvi prost termin med osebami (najzgodnejši; ob enakem času prva oseba v seznamu). */
export function prviProstiTermin(i: IskanjeProstega): ProstTermin | null {
  const korak = i.korakMin ?? 15;
  for (let n = 0; n < i.dni; n++) {
    const datum = dodajDni(i.odDatuma, n);
    let najboljsi: ProstTermin | null = null;
    for (const oseba of i.osebe) {
      const zas = zasedeno(oseba.id, datum, i.termini, i.odsotnosti, i.casovniPas);
      for (const [od, doo] of delovniIntervali(oseba.urnik, datum)) {
        let zacetek = od;
        if (n === 0 && i.odUre) zacetek = Math.max(zacetek, vMinute(i.odUre));
        zacetek = Math.ceil(zacetek / korak) * korak;
        while (zacetek + i.trajanjeMin <= doo) {
          const konec = zacetek + i.trajanjeMin;
          const prekriva = zas.find(([a, b]) => zacetek < b && konec > a);
          if (!prekriva) {
            if (!najboljsi || vMinute(najboljsi.zacetek) > zacetek) {
              najboljsi = { datum, zacetek: izMinut(zacetek), konec: izMinut(konec), osebaId: oseba.id };
            }
            break;
          }
          zacetek = Math.ceil(prekriva[1] / korak) * korak;
        }
      }
    }
    if (najboljsi) return najboljsi;
  }
  return null;
}
