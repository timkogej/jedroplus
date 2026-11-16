import { describe, expect, it } from 'vitest';
import { mejaStarihTerminov } from '@/lib/glas/podatki/omejitev';

const k = (vloga: 'owner' | 'staff', dni: unknown) =>
  ({ vloga, pravice: { past_appointments_days: dni } as never, casovniPas: 'Europe/Ljubljana', zdaj: new Date('2026-11-16T10:00:00Z') });

describe('mejaStarihTerminov', () => {
  it('lastnik nima omejitve', () => expect(mejaStarihTerminov(k('owner', 0))).toBeNull());
  it('null = vse', () => expect(mejaStarihTerminov(k('staff', null))).toBeNull());
  it('0 = od danes', () => expect(mejaStarihTerminov(k('staff', 0))).toBe('2026-11-16'));
  it('7 dni nazaj', () => expect(mejaStarihTerminov(k('staff', 7))).toBe('2026-11-09'));
});
