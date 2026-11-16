// lib/glas/ponudniki/tts.ts
//
// Glasovni odgovor je izbiren (privzeto rezultat samo na zaslonu). Vmesnik je
// pripravljen, da se ponudnik doda z eno datoteko; ElevenLabs TTS namenoma ni
// privzet (predrag pri več uporabnikih). GLAS_TTS = brez | stub.

import type { GlasKonfiguracija } from '../konfiguracija';

export interface TtsOdgovor {
  zvok: ArrayBuffer | null;
  mime: string | null;
  znaki: number;
}

export interface TtsPonudnik {
  ime: string;
  govor(besedilo: string): Promise<TtsOdgovor>;
}

export const ttsBrez: TtsPonudnik = {
  ime: 'brez',
  async govor() {
    return { zvok: null, mime: null, znaki: 0 };
  },
};

/** Stub: šteje znake (za preizkus merjenja), zvoka ne ustvari. */
export const ttsStub: TtsPonudnik = {
  ime: 'stub',
  async govor(besedilo) {
    return { zvok: null, mime: null, znaki: besedilo.length };
  },
};

export function izberiTts(k: GlasKonfiguracija): TtsPonudnik {
  return k.tts === 'stub' ? ttsStub : ttsBrez;
}
