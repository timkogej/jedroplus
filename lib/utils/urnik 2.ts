import type { IzmenicenUrnik, UrnikData } from '@/types/resursi';
import { isIzmenicenUrnik } from '@/types/resursi';

export function getUrnikZaDan(
  urnik: UrnikData | IzmenicenUrnik | null | undefined,
  datum: Date,
): UrnikData {
  if (!urnik) return getDefaultUrnik();

  if (!isIzmenicenUrnik(urnik)) {
    return urnik as UrnikData;
  }

  const zacetek = new Date(urnik.zacetek_cikla);
  // Use UTC midnight to avoid DST distortions
  const zacetekMs = Date.UTC(zacetek.getFullYear(), zacetek.getMonth(), zacetek.getDate());
  const datumMs = Date.UTC(datum.getFullYear(), datum.getMonth(), datum.getDate());

  const daysDiff = Math.floor((datumMs - zacetekMs) / (1000 * 60 * 60 * 24));
  const weeksDiff = Math.floor(daysDiff / 7);

  const vzorec_index =
    ((weeksDiff % urnik.cikel_tednov) + urnik.cikel_tednov) % urnik.cikel_tednov;

  const vzorec = urnik.vzorci[String(vzorec_index)];
  return vzorec ?? getDefaultUrnik();
}

function getDefaultUrnik(): UrnikData {
  return {
    Ponedeljek: { enabled: false, intervals: [] },
    Torek: { enabled: false, intervals: [] },
    Sreda: { enabled: false, intervals: [] },
    Četrtek: { enabled: false, intervals: [] },
    Petek: { enabled: false, intervals: [] },
    Sobota: { enabled: false, intervals: [] },
    Nedelja: { enabled: false, intervals: [] },
  };
}
