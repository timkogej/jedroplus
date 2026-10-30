// Questionnaire before the appointment ("Vprašalnik pred terminom").
//
// The salon's questions live in "Podatki podjetij".vprasalnik; the client's
// answers are stored as a snapshot on Termini / zahteve_termini
// (vprasalnik_odgovori). See supabase/migrations/1793200000_vprasalnik.sql.

export type QuestionType = 'besedilo' | 'da_ne' | 'izbira';

export interface Question {
  id: string;
  vprasanje: string;
  /** English wording for clients who book in English; empty = use Slovenian. */
  vprasanje_en?: string;
  tip: QuestionType;
  /** Options for 'izbira'. */
  moznosti?: string[];
  /** English options, same order as `moznosti`. */
  moznosti_en?: string[];
  obvezno: boolean;
  /** Service ids ("Storitve".id); empty = every service. */
  storitve: string[];
}

export interface Answer {
  id: string;
  vprasanje: string;
  odgovor: string;
}

export const MAX_QUESTIONS = 10;
export const MAX_OPTIONS = 8;
const MAX_QUESTION_LEN = 200;
const MAX_OPTION_LEN = 80;

const clean = (v: unknown, max: number) =>
  String(v ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

export function newQuestionId(): string {
  return `q_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Returns a valid question list, or null when the input is not a list.
 * Questions without wording and choice questions with fewer than two options
 * are dropped, so the booking page never shows a broken question.
 */
export function sanitizeQuestions(input: unknown): Question[] | null {
  if (!Array.isArray(input)) return null;
  const seen = new Set<string>();
  const out: Question[] = [];

  for (const raw of input.slice(0, MAX_QUESTIONS)) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const vprasanje = clean(r.vprasanje, MAX_QUESTION_LEN);
    if (!vprasanje) continue;

    const tip: QuestionType = r.tip === 'da_ne' || r.tip === 'izbira' ? r.tip : 'besedilo';
    let id = clean(r.id, 40).replace(/[^a-zA-Z0-9_-]/g, '');
    if (!id || seen.has(id)) id = newQuestionId();
    seen.add(id);

    const q: Question = {
      id,
      vprasanje,
      tip,
      obvezno: r.obvezno === true,
      storitve: Array.isArray(r.storitve) ? r.storitve.map((s) => clean(s, 40)).filter(Boolean).slice(0, 200) : [],
    };
    const en = clean(r.vprasanje_en, MAX_QUESTION_LEN);
    if (en) q.vprasanje_en = en;

    if (tip === 'izbira') {
      const options = (Array.isArray(r.moznosti) ? r.moznosti : [])
        .map((o) => clean(o, MAX_OPTION_LEN))
        .filter(Boolean)
        .slice(0, MAX_OPTIONS);
      if (options.length < 2) continue;
      q.moznosti = options;
      const optionsEn = Array.isArray(r.moznosti_en) ? r.moznosti_en.map((o) => clean(o, MAX_OPTION_LEN)) : [];
      if (optionsEn.some(Boolean)) q.moznosti_en = options.map((_, i) => optionsEn[i] || '');
    }
    out.push(q);
  }
  return out;
}

/** Reads stored answers (jsonb, sometimes a JSON string) into a clean list. */
export function parseAnswers(value: unknown): Answer[] {
  let v = value;
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(v)) return [];
  return v
    .filter((a): a is Record<string, unknown> => Boolean(a) && typeof a === 'object')
    .map((a) => ({
      id: String(a.id ?? ''),
      vprasanje: String(a.vprasanje ?? '').trim(),
      odgovor: String(a.odgovor ?? '').trim(),
    }))
    .filter((a) => a.vprasanje && a.odgovor);
}
