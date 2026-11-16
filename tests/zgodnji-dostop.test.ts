import { afterEach, describe, expect, it, vi } from 'vitest';
import { imaZgodnjiDostop } from '@/lib/zgodnjiDostop';

describe('zgodnji dostop', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('brez spremenljivke: samo testni salon', () => {
    vi.stubEnv('NEXT_PUBLIC_ZGODNJI_DOSTOP', undefined as unknown as string);
    expect(imaZgodnjiDostop('7LHB28')).toBe(true);
    expect(imaZgodnjiDostop('7lhb28')).toBe(true);
    expect(imaZgodnjiDostop('NYCD5B')).toBe(false);
    expect(imaZgodnjiDostop(null)).toBe(false);
  });

  it('seznam in »*«', () => {
    vi.stubEnv('NEXT_PUBLIC_ZGODNJI_DOSTOP', '7LHB28, NYCD5B');
    expect(imaZgodnjiDostop('NYCD5B')).toBe(true);
    expect(imaZgodnjiDostop('B429FG')).toBe(false);
    vi.stubEnv('NEXT_PUBLIC_ZGODNJI_DOSTOP', '*');
    expect(imaZgodnjiDostop('B429FG')).toBe(true);
  });
});
