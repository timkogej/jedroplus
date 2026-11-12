// lib/glas/ponudniki/soniox.ts
//
// Soniox (isti ponudnik kot Receptionist+): sprotna razpoznava in glas Nina.
// Zvok ne gre prek našega strežnika: brskalnik se poveže neposredno na Soniox s
// kratkotrajnim ključem, ki ga izda ta modul. Glavni ključ (SONIOX_API_KEY)
// ostane samo na strežniku in se nikoli ne izpiše.
// Faza 0 (docs/glasovni-asistent-faza0.md): 4,6 % WER z namigi, konec govora
// ~0,6 s po zadnji besedi, prvi zvok glasu ~0,37 s.

import { fetchSPonovitvijo, NapakaPonudnika } from './skupno';

export const SONIOX = {
  sttUrl: 'wss://stt-rt.soniox.com/transcribe-websocket',
  ttsUrl: 'wss://tts-rt.soniox.com/tts-websocket',
  sttModel: 'stt-rt-v5',
  ttsModel: 'tts-rt-v2',
  glas: 'Nina',
  hitrost: 1.04,
  /** Faza 0: 1000 ms je natančneje in skoraj enako hitro kot 500 ms + raven 3. */
  najdaljsiKonecMs: 1000,
} as const;

export type NamenKljuca = 'transcribe_websocket' | 'tts_rt';

/** Kratkotrajni ključ za brskalnik (velja `sekunde`, samo za en namen). */
export async function zacasniKljuc(
  namen: NamenKljuca,
  sekunde: number,
  env: Record<string, string | undefined> = process.env,
  timeoutMs = 4000
): Promise<{ kljuc: string; potece: string }> {
  const glavni = env.SONIOX_API_KEY;
  if (!glavni) throw new NapakaPonudnika('soniox', 'ni_nastavljen');
  const res = await fetchSPonovitvijo(
    'soniox',
    'https://api.soniox.com/v1/auth/temporary-api-key',
    () => ({
      method: 'POST',
      headers: { Authorization: `Bearer ${glavni}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ usage_type: namen, expires_in_seconds: sekunde }),
    }),
    timeoutMs
  );
  const telo = (await res.json().catch(() => null)) as { api_key?: unknown; expires_at?: unknown } | null;
  if (!telo || typeof telo.api_key !== 'string' || !telo.api_key) throw new NapakaPonudnika('soniox', 'streznik');
  return { kljuc: telo.api_key, potece: typeof telo.expires_at === 'string' ? telo.expires_at : new Date(Date.now() + sekunde * 1000).toISOString() };
}
