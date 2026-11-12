// lib/glas/ponudniki/skupno.ts
//
// Skupno za ponudnike: časovna omejitev, en ponovni poskus z zamikom pri
// začasnih napakah (429, 5xx, omrežje), enotna napaka brez skrivnosti.

export class NapakaPonudnika extends Error {
  constructor(
    public readonly ponudnik: string,
    public readonly vrsta: 'casovna_omejitev' | 'omejitev' | 'streznik' | 'zavrnjeno' | 'omrezje' | 'ni_nastavljen',
    public readonly status?: number
  ) {
    // Nikoli ne vključi telesa odgovora ali ključa: lahko vsebuje osebne podatke.
    super(`${ponudnik}: ${vrsta}${status ? ` (${status})` : ''}`);
    this.name = 'NapakaPonudnika';
  }

  get zacasna() {
    return this.vrsta !== 'zavrnjeno' && this.vrsta !== 'ni_nastavljen';
  }
}

const pocakaj = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** fetch s časovno omejitvijo in enim ponovnim poskusom pri začasni napaki. */
export async function fetchSPonovitvijo(
  ponudnik: string,
  url: string,
  init: () => RequestInit,
  timeoutMs: number,
  poskusov = 2
): Promise<Response> {
  let zadnja: NapakaPonudnika | null = null;
  for (let poskus = 0; poskus < poskusov; poskus++) {
    if (poskus > 0) await pocakaj(300 + Math.floor(Math.random() * 200));
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init(), signal: ctrl.signal });
      if (res.ok) return res;
      await res.body?.cancel().catch(() => {});
      if (res.status === 429) zadnja = new NapakaPonudnika(ponudnik, 'omejitev', res.status);
      else if (res.status >= 500) zadnja = new NapakaPonudnika(ponudnik, 'streznik', res.status);
      else throw new NapakaPonudnika(ponudnik, 'zavrnjeno', res.status);
    } catch (e) {
      if (e instanceof NapakaPonudnika && !e.zacasna) throw e;
      if (e instanceof NapakaPonudnika) zadnja = e;
      else if (e instanceof Error && e.name === 'AbortError') zadnja = new NapakaPonudnika(ponudnik, 'casovna_omejitev');
      else zadnja = new NapakaPonudnika(ponudnik, 'omrezje');
    } finally {
      clearTimeout(t);
    }
  }
  throw zadnja ?? new NapakaPonudnika(ponudnik, 'omrezje');
}
