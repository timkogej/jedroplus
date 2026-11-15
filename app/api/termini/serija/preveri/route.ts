// app/api/termini/serija/preveri/route.ts
//
// Ponavljajoči termin (koledar, »Ponovi«): preveri vse datume serije za zaposlenega —
// delovni čas, odsotnosti, prekrivanje — in za zasedene predlaga najbližji prost čas.
// Bere z uporabnikovo sejo (RLS). Ničesar ne zapiše.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit } from '@/lib/rateLimit';
import { imaPravico, samoSvojiTermini } from '@/lib/glas/pravice';
import { zdajVPasu } from '@/lib/glas/razresevanje/datumi';
import { kontekstIzSeje, preberiJson } from '@/lib/glas/streznik';
import { preveriSerijoSalona } from '@/lib/termini/preveriSerijoSalona';
import { NAJVEC_TERMINOV } from '@/lib/termini/serija';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Vhod = z.object({
  oseba: z.string().trim().min(1).max(64),
  datum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ura: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  trajanje: z.number().int().min(5).max(24 * 60),
  vsakihTednov: z.number().int().min(1).max(26),
  // 1 = samo ta datum (ponovno preverjanje tik pred shranjevanjem).
  krat: z.number().int().min(1).max(NAJVEC_TERMINOV),
});

const odziv = (status: number, koda: string) => NextResponse.json({ ok: false, koda }, { status });

export async function POST(req: NextRequest) {
  const omejitev = await rateLimit(req, 'api');
  if (!omejitev.success) return odziv(429, 'prehitro');
  const v = Vhod.safeParse(await preberiJson(req, 1024));
  if (!v.success) return odziv(400, 'napacen_vhod');

  const kont = await kontekstIzSeje();
  if (!kont.ok) return kont.odziv;
  const { k, odvisnosti } = kont;
  if (!imaPravico(k, 'termini.ustvarjanje')) return odziv(403, 'ni_pravice');
  if (samoSvojiTermini(k) && v.data.oseba !== k.osebaId) return odziv(403, 'ni_pravice');

  const oseba = (await odvisnosti.podatki.osebe()).find((o) => o.id === v.data.oseba);
  if (!oseba) return odziv(404, 'ni_osebe');
  const zdaj = zdajVPasu(new Date(), k.casovniPas);
  try {
    const datumi = await preveriSerijoSalona(odvisnosti.podatki, {
      oseba,
      prvi: v.data.datum,
      ura: v.data.ura,
      trajanjeMin: v.data.trajanje,
      ritem: { vsakihTednov: v.data.vsakihTednov, stevilo: v.data.krat, doDatuma: null },
      casovniPas: k.casovniPas,
      danes: zdaj.datum,
      uraZdaj: zdaj.ura,
    });
    return NextResponse.json({ ok: true, datumi }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return odziv(500, 'napaka');
  }
}
