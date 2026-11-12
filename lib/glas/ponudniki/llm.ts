// lib/glas/ponudniki/llm.ts
//
// Razumevanje ukaza z orodji. Jedro govori nevtralno obliko (LlmZahteva/LlmOdgovor),
// prilagojevalnik jo prevede za ponudnika. GLAS_LLM = anthropic | lazni.
//
// Anthropic: claude-haiku-5-5 (najcenejši model z orodji), brez razmišljanja
// (dovoljeno pri privzetem effort medium), tool_choice auto, strogi JSON shemi.
// Sistemski poziv in orodja so stabilna in na začetku, zato ju predpomnimo
// (cache_control na sistemskem bloku); spremenljivi kontekst (datum, ime) je v
// uporabniškem sporočilu, da ne razveljavi predpomnilnika.

import Anthropic from '@anthropic-ai/sdk';
import type { GlasKonfiguracija } from '../konfiguracija';
import type { JsonShema } from '../tipi';
import { NapakaPonudnika } from './skupno';

export interface LlmOrodje {
  ime: string;
  opis: string;
  shema: JsonShema;
}

export interface LlmKlic {
  id: string;
  ime: string;
  vhod: unknown;
}

export type LlmSporocilo =
  | { vloga: 'uporabnik'; besedilo: string }
  | { vloga: 'asistent'; besedilo: string; klici: LlmKlic[]; surovo?: unknown }
  | { vloga: 'rezultati'; rezultati: { id: string; vsebina: string; napaka?: boolean }[] };

export interface LlmZahteva {
  sistem: string;
  orodja: LlmOrodje[];
  sporocila: LlmSporocilo[];
  najvecIzhoda: number;
}

export interface LlmOdgovor {
  besedilo: string;
  klici: LlmKlic[];
  konec: 'konec' | 'orodja' | 'meja' | 'zavrnitev';
  surovo?: unknown;
  model: string;
  poraba: { vhod: number; vhodPredpomnjen: number; vhodZapis: number; izhod: number };
}

export interface LlmPonudnik {
  ime: string;
  pogovor(z: LlmZahteva): Promise<LlmOdgovor>;
}

export function llmAnthropic(model: string, timeoutMs: number, client?: Anthropic): LlmPonudnik {
  const c = client ?? new Anthropic({ maxRetries: 1, timeout: timeoutMs });
  return {
    ime: 'anthropic',
    async pogovor(z) {
      const messages: Anthropic.MessageParam[] = z.sporocila.map((s) => {
        if (s.vloga === 'uporabnik') return { role: 'user', content: s.besedilo };
        if (s.vloga === 'asistent') {
          if (Array.isArray(s.surovo)) return { role: 'assistant', content: s.surovo as Anthropic.ContentBlockParam[] };
          const vsebina: Anthropic.ContentBlockParam[] = [];
          if (s.besedilo) vsebina.push({ type: 'text', text: s.besedilo });
          for (const k of s.klici) vsebina.push({ type: 'tool_use', id: k.id, name: k.ime, input: k.vhod as Record<string, unknown> });
          return { role: 'assistant', content: vsebina };
        }
        return {
          role: 'user',
          content: s.rezultati.map((r) => ({
            type: 'tool_result' as const,
            tool_use_id: r.id,
            content: r.vsebina,
            ...(r.napaka ? { is_error: true } : {}),
          })),
        };
      });

      let odgovor: Anthropic.Message;
      try {
        odgovor = await c.messages.create({
          model,
          max_tokens: z.najvecIzhoda,
          thinking: { type: 'disabled' },
          system: [{ type: 'text', text: z.sistem, cache_control: { type: 'ephemeral' } }],
          tools: z.orodja.map((o) => ({
            name: o.ime,
            description: o.opis,
            input_schema: o.shema as Anthropic.Tool.InputSchema,
            strict: true,
          })),
          tool_choice: { type: 'auto' },
          messages,
        });
      } catch (e) {
        if (e instanceof Anthropic.RateLimitError) throw new NapakaPonudnika('anthropic', 'omejitev', 429);
        if (e instanceof Anthropic.APIConnectionTimeoutError) throw new NapakaPonudnika('anthropic', 'casovna_omejitev');
        if (e instanceof Anthropic.APIConnectionError) throw new NapakaPonudnika('anthropic', 'omrezje');
        if (e instanceof Anthropic.AuthenticationError) throw new NapakaPonudnika('anthropic', 'ni_nastavljen', 401);
        if (e instanceof Anthropic.APIError) {
          const status = typeof e.status === 'number' ? e.status : undefined;
          throw new NapakaPonudnika('anthropic', status && status >= 500 ? 'streznik' : 'zavrnjeno', status);
        }
        throw new NapakaPonudnika('anthropic', 'omrezje');
      }

      const klici: LlmKlic[] = [];
      let besedilo = '';
      for (const b of odgovor.content) {
        if (b.type === 'text') besedilo += b.text;
        else if (b.type === 'tool_use') klici.push({ id: b.id, ime: b.name, vhod: b.input });
      }
      const u = odgovor.usage;
      return {
        besedilo: besedilo.trim(),
        klici,
        konec:
          odgovor.stop_reason === 'tool_use'
            ? 'orodja'
            : odgovor.stop_reason === 'max_tokens'
              ? 'meja'
              : odgovor.stop_reason === 'refusal'
                ? 'zavrnitev'
                : 'konec',
        surovo: odgovor.content,
        model: odgovor.model ?? model,
        poraba: {
          vhod: u.input_tokens ?? 0,
          vhodPredpomnjen: u.cache_read_input_tokens ?? 0,
          vhodZapis: u.cache_creation_input_tokens ?? 0,
          izhod: u.output_tokens ?? 0,
        },
      };
    },
  };
}

/** Za teste: vnaprej pripravljeni odgovori po vrsti; zabeleži zahteve. */
export function llmLazni(odgovori: Partial<LlmOdgovor>[]): LlmPonudnik & { zahteve: LlmZahteva[] } {
  const zahteve: LlmZahteva[] = [];
  let i = 0;
  return {
    ime: 'lazni',
    zahteve,
    async pogovor(z) {
      zahteve.push(JSON.parse(JSON.stringify(z)));
      const o = odgovori[Math.min(i++, odgovori.length - 1)] ?? {};
      if (o instanceof Error) throw o;
      const klici = o.klici ?? [];
      return {
        besedilo: o.besedilo ?? '',
        klici,
        konec: o.konec ?? (klici.length ? 'orodja' : 'konec'),
        model: 'lazni',
        poraba: o.poraba ?? { vhod: 100, vhodPredpomnjen: 0, vhodZapis: 0, izhod: 20 },
      };
    },
  };
}

export function izberiLlm(k: GlasKonfiguracija, env: Record<string, string | undefined> = process.env): LlmPonudnik {
  if (k.llm === 'lazni') return llmLazni([{ besedilo: 'Lažni LLM.' }]);
  if (!env.ANTHROPIC_API_KEY) throw new NapakaPonudnika('anthropic', 'ni_nastavljen');
  return llmAnthropic(k.llmModel, k.llmTimeoutMs);
}
