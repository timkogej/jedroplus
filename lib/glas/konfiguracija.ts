// lib/glas/konfiguracija.ts
//
// Vse nastavitve glasovnega asistenta iz okoljskih spremenljivk. Menjava
// ponudnika je sprememba spremenljivke, ne kode. Ključi API se tu samo
// preberejo; nikoli se ne izpišejo.

export type SttIme = 'elevenlabs' | 'openai' | 'lazni';
export type LlmIme = 'anthropic' | 'lazni';
export type TtsIme = 'brez' | 'stub';

function izbira<T extends string>(vrednost: string | undefined, dovoljeno: readonly T[], privzeto: T): T {
  const v = (vrednost ?? '').trim().toLowerCase() as T;
  return dovoljeno.includes(v) ? v : privzeto;
}

function stevilo(vrednost: string | undefined, privzeto: number): number {
  const n = Number(vrednost);
  return Number.isFinite(n) && n > 0 ? n : privzeto;
}

export function preberiKonfiguracijo(env: Record<string, string | undefined> = process.env) {
  return {
    stt: izbira<SttIme>(env.GLAS_STT, ['elevenlabs', 'openai', 'lazni'], 'elevenlabs'),
    llm: izbira<LlmIme>(env.GLAS_LLM, ['anthropic', 'lazni'], 'anthropic'),
    tts: izbira<TtsIme>(env.GLAS_TTS, ['brez', 'stub'], 'brez'),
    llmModel: (env.GLAS_LLM_MODEL ?? '').trim() || 'claude-haiku-5-5',
    elevenlabsModel: (env.GLAS_ELEVENLABS_MODEL ?? '').trim() || 'scribe_v2',
    openaiSttModel: (env.GLAS_OPENAI_STT_MODEL ?? '').trim() || 'gpt-4o-mini-transcribe',
    /** Koliko časa velja predlog, preden ga je treba potrditi. */
    predlogPotekS: stevilo(env.GLAS_PREDLOG_POTEK_S, 120),
    sttTimeoutMs: stevilo(env.GLAS_STT_TIMEOUT_MS, 10_000),
    llmTimeoutMs: stevilo(env.GLAS_LLM_TIMEOUT_MS, 12_000),
    najvecZvokaBajtov: stevilo(env.GLAS_NAJVEC_ZVOKA_BAJTOV, 1_000_000),
    najvecBesedila: 500,
    /** ElevenLabs: nad 100 izrazi se vsak klic obračuna kot ≥20 s. */
    najvecNamigov: 100,
    najvecKrogovLlm: 3,
  };
}

export type GlasKonfiguracija = ReturnType<typeof preberiKonfiguracijo>;
