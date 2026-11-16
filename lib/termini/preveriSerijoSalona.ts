// lib/termini/preveriSerijoSalona.ts
//
// Preverjanje serije nad podatki salona (uporabnikova seja → RLS). Skupno za Asistent+
// (pripravi_serijo) in koledar (/api/termini/serija/preveri).

import { razcleniUrnik, urnikOsebe } from '@/lib/glas/razresevanje/urnik';
import type { OsebaPovzetek, PodatkiSalona } from '@/lib/glas/tipi';
import { dodajDni } from '@/lib/glas/razresevanje/datumi';
import { datumiSerije, obsegSerije, preveriSerijo, type DatumSerije, type Ritem } from './serija';

export interface ZahtevaSerije {
  oseba: OsebaPovzetek;
  prvi: string;
  ura: string;
  trajanjeMin: number;
  ritem: Ritem;
  casovniPas: string;
  danes: string;
  uraZdaj?: string;
  /** "ID termina", ki jih ne štejemo (pri prestavitvi serije: termini, ki se premikajo). */
  brez?: string[];
}

export async function preveriSerijoSalona(podatki: PodatkiSalona, z: ZahtevaSerije): Promise<DatumSerije[]> {
  const datumi = datumiSerije(z.prvi, z.ritem);
  if (!datumi.length) return [];
  const { od, doo } = obsegSerije(datumi);
  // Termini po oknih okoli vsakega datuma (±3 dni za predloge): celo leto bi preseglo omejitev vrstic.
  const [urnikSurov, okna, odsotnosti] = await Promise.all([
    podatki.urnikPodjetja(),
    Promise.all(datumi.map((d) => podatki.termini(dodajDni(d, -3), dodajDni(d, 3)))),
    podatki.odsotnosti(od, doo),
  ]);
  const termini = [...new Map(okna.flat().map((t) => [t.id, t])).values()];
  return preveriSerijo({
    datumi,
    ura: z.ura,
    trajanjeMin: z.trajanjeMin,
    osebaId: z.oseba.id,
    urnik: urnikOsebe(z.oseba, razcleniUrnik(urnikSurov)),
    termini: termini.filter((t) => t.osebaId === z.oseba.id && !z.brez?.includes(t.id)),
    odsotnosti: odsotnosti.filter((x) => x.osebaId === null || x.osebaId === z.oseba.id),
    casovniPas: z.casovniPas,
    odDatuma: z.danes,
    odUre: z.uraZdaj,
  });
}
