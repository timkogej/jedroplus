// lib/zgodnjiDostop.ts
//
// Zgodnji dostop: nove funkcije (Asistent+, stran »AI asistenti«, ponavljajoči termini,
// zapiski stranke) so v produkciji vidne samo izbranim podjetjem, dokler jih Tim ne
// preizkusi (17. 11. 2026). Ostala podjetja vidijo aplikacijo kot prej.
//
// Seznam: NEXT_PUBLIC_ZGODNJI_DOSTOP na Vercelu = besedilni ID-ji podjetij, ločeni z
// vejico (npr. "7LHB28,AB12CD"), ali "*" za vse. Brez spremenljivke velja samo testni
// salon. Sprememba začne veljati ob naslednji izdaji (NEXT_PUBLIC se vgradi ob gradnji).

const PRIVZETO = '7LHB28';

function seznam(): { vsi: boolean; ids: Set<string> } {
  const surovo = (process.env.NEXT_PUBLIC_ZGODNJI_DOSTOP ?? PRIVZETO).trim() || PRIVZETO;
  const deli = surovo.split(',').map((x) => x.trim().toUpperCase()).filter(Boolean);
  return { vsi: deli.includes('*'), ids: new Set(deli) };
}

/** `podjetje` = besedilni ID podjetja (companies.company_id, npr. "7LHB28"). */
export function imaZgodnjiDostop(podjetje: string | null | undefined): boolean {
  const s = seznam();
  if (s.vsi) return true;
  return Boolean(podjetje) && s.ids.has(String(podjetje).trim().toUpperCase());
}
