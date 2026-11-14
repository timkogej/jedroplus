// lib/glas/ponudniki/stt.ts
//
// Pretvorba govora v besedilo. Ponudnika izbere GLAS_STT (elevenlabs | openai | lazni).
// Zvok se pošlje ponudniku in se pri nas nikoli ne shrani.

import type { GlasKonfiguracija } from '../konfiguracija';
import { NapakaPonudnika, fetchSPonovitvijo } from './skupno';

export interface SttZahteva {
  zvok: Blob;
  /** ISO 639-1 (jezik pogovora Asistent+) */
  jezik: 'sl' | 'en' | 'de' | 'it' | 'hr';
  /** Imena strank/storitev/oseb in strokovni izrazi (≤100). */
  namigi: string[];
}

export interface SttOdgovor {
  besedilo: string;
  sekunde: number;
  zNamigi: boolean;
}

export interface SttPonudnik {
  ime: string;
  prepisi(z: SttZahteva): Promise<SttOdgovor>;
}

/** Ime datoteke s pravo končnico (OpenAI format prepozna po končnici; iOS snema mp4). */
export function imeDatoteke(zvok: Blob): string {
  const t = (zvok.type || '').toLowerCase();
  if (t.includes('mp4') || t.includes('m4a') || t.includes('aac')) return 'ukaz.m4a';
  if (t.includes('ogg')) return 'ukaz.ogg';
  if (t.includes('wav')) return 'ukaz.wav';
  if (t.includes('mpeg') || t.includes('mp3')) return 'ukaz.mp3';
  return 'ukaz.webm';
}

/** ElevenLabs Scribe: POST /v1/speech-to-text, multipart, `keyterms` (≤100 brez 20-s minimalnega obračuna). */
export function sttElevenlabs(kljuc: string, model: string, timeoutMs: number): SttPonudnik {
  return {
    ime: 'elevenlabs',
    async prepisi({ zvok, jezik, namigi }) {
      const izrazi = ociscenNamigi(namigi, 50, 5).slice(0, 100);
      const res = await fetchSPonovitvijo(
        'elevenlabs',
        'https://api.elevenlabs.io/v1/speech-to-text',
        () => {
          const f = new FormData();
          f.append('model_id', model);
          f.append('file', zvok, imeDatoteke(zvok));
          f.append('language_code', jezik);
          f.append('tag_audio_events', 'false');
          f.append('diarize', 'false');
          for (const k of izrazi) f.append('keyterms', k);
          return { method: 'POST', headers: { 'xi-api-key': kljuc }, body: f };
        },
        timeoutMs
      );
      const j = (await res.json()) as { text?: string; audio_duration_secs?: number; words?: { end?: number }[] };
      const zadnja = j.words?.length ? Number(j.words[j.words.length - 1]?.end ?? 0) : 0;
      return {
        besedilo: String(j.text ?? '').trim(),
        sekunde: Number(j.audio_duration_secs ?? zadnja) || 0,
        zNamigi: izrazi.length > 0,
      };
    },
  };
}

/** OpenAI: POST /v1/audio/transcriptions, `prompt` kot prost tekst z izrazi. */
export function sttOpenai(kljuc: string, model: string, timeoutMs: number): SttPonudnik {
  return {
    ime: 'openai',
    async prepisi({ zvok, jezik, namigi }) {
      const prompt = ociscenNamigi(namigi, 50, 5).slice(0, 100).join(', ');
      const res = await fetchSPonovitvijo(
        'openai',
        'https://api.openai.com/v1/audio/transcriptions',
        () => {
          const f = new FormData();
          f.append('model', model);
          f.append('file', zvok, imeDatoteke(zvok));
          f.append('language', jezik);
          f.append('response_format', 'json');
          if (prompt) f.append('prompt', `Salon. Izrazi: ${prompt}.`);
          return { method: 'POST', headers: { Authorization: `Bearer ${kljuc}` }, body: f };
        },
        timeoutMs
      );
      const j = (await res.json()) as { text?: string; usage?: { seconds?: number } };
      return {
        besedilo: String(j.text ?? '').trim(),
        // Odgovor ne vrne vedno trajanja; ocena iz velikosti (≈ 16 kB/s za opus webm) je samo za strošek.
        sekunde: Number(j.usage?.seconds ?? 0) || Math.max(1, zvok.size / 16_000),
        zNamigi: prompt.length > 0,
      };
    },
  };
}

/** Za teste in razvoj brez ključa: vrne vnaprej določeno besedilo. */
export function sttLazni(odgovori: string[] | ((z: SttZahteva) => string) = ['']): SttPonudnik {
  let i = 0;
  return {
    ime: 'lazni',
    async prepisi(z) {
      const besedilo = typeof odgovori === 'function' ? odgovori(z) : odgovori[Math.min(i++, odgovori.length - 1)];
      return { besedilo, sekunde: 3, zNamigi: z.namigi.length > 0 };
    },
  };
}

/** Odstrani prepovedane znake, omeji dolžino in število besed, odstrani podvojene. */
export function ociscenNamigi(namigi: string[], najvecZnakov: number, najvecBesed: number): string[] {
  const videno = new Set<string>();
  const out: string[] = [];
  for (const n of namigi) {
    const c = n.replace(/[<>{}[\]\\]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!c || c.length > najvecZnakov || c.split(' ').length > najvecBesed) continue;
    const k = c.toLowerCase();
    if (videno.has(k)) continue;
    videno.add(k);
    out.push(c);
  }
  return out;
}

export function izberiStt(k: GlasKonfiguracija, env: Record<string, string | undefined> = process.env): SttPonudnik {
  if (k.stt === 'lazni') return sttLazni(['']);
  if (k.stt === 'openai') {
    if (!env.OPENAI_API_KEY) throw new NapakaPonudnika('openai', 'ni_nastavljen');
    return sttOpenai(env.OPENAI_API_KEY, k.openaiSttModel, k.sttTimeoutMs);
  }
  if (!env.ELEVENLABS_API_KEY) throw new NapakaPonudnika('elevenlabs', 'ni_nastavljen');
  return sttElevenlabs(env.ELEVENLABS_API_KEY, k.elevenlabsModel, k.sttTimeoutMs);
}
