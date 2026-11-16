// Anthropic zavrne zahtevo (400), če imajo stroga orodja skupaj več kot 16
// parametrov z unijo tipov (npr. ["string","null"]) ali anyOf.
import { describe, expect, it } from 'vitest';
import { VSA_ORODJA } from '@/lib/glas/orodja/registry';

function unije(shema: unknown): number {
  if (!shema || typeof shema !== 'object') return 0;
  const s = shema as Record<string, unknown>;
  let n = Array.isArray(s.type) || Array.isArray(s.anyOf) ? 1 : 0;
  for (const v of Object.values((s.properties as Record<string, unknown>) ?? {})) n += unije(v);
  if (s.items) n += unije(s.items);
  return n;
}

describe('meje ponudnika LLM', () => {
  it('stroga orodja imajo skupaj največ 16 parametrov z unijo', () => {
    const stroga = VSA_ORODJA.filter((o) => o.razred !== 'branje');
    const skupaj = stroga.reduce((a, o) => a + unije(o.shema), 0);
    expect(skupaj).toBeLessThanOrEqual(16);
  });
});
