// lib/glas/poraba.ts
//
// Cenik ponudnikov in izračun stroška enega ukaza v mikro USD (1 = 0,000001 USD).
// Menjava cene = ena vrstica tukaj. Cene STT so OCENE — preveri pri ponudniku,
// preden se zanesemo nanje (docs/glasovni-asistent-nacrt.md §7).

import { jt } from './jeziki/t';

export interface PorabaUkaza {
  sttPonudnik: string | null;
  sttSekunde: number;
  sttZNamigi: boolean;
  llmModel: string | null;
  llmVhod: number;
  llmVhodPredpomnjen: number;
  llmVhodZapisPredpomnilnika: number;
  llmIzhod: number;
  ttsPonudnik: string | null;
  ttsZnaki: number;
}

export const PRAZNA_PORABA: PorabaUkaza = {
  sttPonudnik: null,
  sttSekunde: 0,
  sttZNamigi: false,
  llmModel: null,
  llmVhod: 0,
  llmVhodPredpomnjen: 0,
  llmVhodZapisPredpomnilnika: 0,
  llmIzhod: 0,
  ttsPonudnik: null,
  ttsZnaki: 0,
};

/** USD na uro zvoka. */
const STT_NA_URO: Record<string, number> = {
  elevenlabs: 0.4, // Scribe; +20 % z namigi (keyterms) — OCENA
  openai: 0.18, // gpt-4o-mini-transcribe ~0,003 $/min — OCENA
  soniox: 0.12, // stt-rt sprotno, soniox.com/pricing 12. 11. 2026 (namigi so žetoni besedila, zanemarljivo)
  lazni: 0,
};

/** USD na milijon žetonov. */
const LLM_CENE: Record<string, { vhod: number; izhod: number }> = {
  'claude-haiku-5-5': { vhod: 0.1, izhod: 0.5 },
  'claude-sonnet-5-5': { vhod: 2, izhod: 10 },
  lazni: { vhod: 0, izhod: 0 },
};

/** USD na milijon znakov. */
// Soniox ~0,70 $/h govora ≈ 13 $/M znakov pri ~15 znakih/s — OCENA (soniox.com/pricing 12. 11. 2026).
const TTS_NA_MILIJON: Record<string, number> = { brez: 0, stub: 0, soniox: 13 };

export function strosekMikroUsd(p: PorabaUkaza): number {
  let usd = 0;
  if (p.sttPonudnik) {
    const naUro = STT_NA_URO[p.sttPonudnik] ?? 0;
    usd += (p.sttSekunde / 3600) * naUro * (p.sttZNamigi && p.sttPonudnik === 'elevenlabs' ? 1.2 : 1);
  }
  if (p.llmModel) {
    const c = LLM_CENE[p.llmModel] ?? LLM_CENE['claude-haiku-5-5'];
    // input_tokens pri Anthropic NE vključuje predpomnjenih; branje 0,1×, zapis 1,25×
    usd +=
      (p.llmVhod * c.vhod +
        p.llmVhodPredpomnjen * c.vhod * 0.1 +
        p.llmVhodZapisPredpomnilnika * c.vhod * 1.25 +
        p.llmIzhod * c.izhod) /
      1_000_000;
  }
  if (p.ttsPonudnik) usd += (p.ttsZnaki / 1_000_000) * (TTS_NA_MILIJON[p.ttsPonudnik] ?? 0);
  return Math.round(usd * 1_000_000 * 1000) / 1000;
}

export function sestejPorabo(a: PorabaUkaza, b: Partial<PorabaUkaza>): PorabaUkaza {
  return {
    sttPonudnik: b.sttPonudnik ?? a.sttPonudnik,
    sttSekunde: a.sttSekunde + (b.sttSekunde ?? 0),
    sttZNamigi: a.sttZNamigi || Boolean(b.sttZNamigi),
    llmModel: b.llmModel ?? a.llmModel,
    llmVhod: a.llmVhod + (b.llmVhod ?? 0),
    llmVhodPredpomnjen: a.llmVhodPredpomnjen + (b.llmVhodPredpomnjen ?? 0),
    llmVhodZapisPredpomnilnika: a.llmVhodZapisPredpomnilnika + (b.llmVhodZapisPredpomnilnika ?? 0),
    llmIzhod: a.llmIzhod + (b.llmIzhod ?? 0),
    ttsPonudnik: b.ttsPonudnik ?? a.ttsPonudnik,
    ttsZnaki: a.ttsZnaki + (b.ttsZnaki ?? 0),
  };
}

/** Sporočilo ob 80 % in 100 % kvote. */
export function opozoriloKvote(porabljeno: number, kvota: number): string | null {
  if (kvota <= 0) return null;
  if (porabljeno >= kvota) {
    return jt('Mesečna kvota glasovnih ukazov je porabljena ({porabljeno}/{kvota}). Nova se začne 1. v mesecu.', { porabljeno, kvota });
  }
  if (porabljeno >= Math.ceil(kvota * 0.8)) {
    return jt('Porabljenih je {porabljeno} od {kvota} glasovnih ukazov ta mesec.', { porabljeno, kvota });
  }
  return null;
}
