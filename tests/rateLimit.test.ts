// Omejevalnik: ob izpadu Redis zahteve ne čakajo vsakič na časovno omejitev.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const limit = vi.fn();
vi.mock('@upstash/redis', () => ({ Redis: class {} }));
vi.mock('@upstash/ratelimit', () => {
  class Ratelimit {
    static slidingWindow() {
      return {};
    }
    limit = limit;
  }
  return { Ratelimit };
});

const zahteva = { headers: new Headers({ 'x-forwarded-for': '1.2.3.4' }) } as unknown as NextRequest;

async function modul() {
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://primer.upstash.io');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'x');
  vi.resetModules();
  return import('@/lib/rateLimit');
}

describe('rateLimit ob izpadu Redis', () => {
  beforeEach(() => {
    limit.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('po časovni omejitvi 60 s ne sprašuje Redis, nato spet', async () => {
    vi.useFakeTimers();
    const { rateLimit, IZPAD_PRESKOK_MS } = await modul();
    limit.mockResolvedValue({ success: true, limit: 20, remaining: 19, reset: 0, reason: 'timeout' });
    expect((await rateLimit(zahteva, 'ai')).success).toBe(true);
    expect(limit).toHaveBeenCalledTimes(1);

    expect((await rateLimit(zahteva, 'ai')).success).toBe(true);
    expect(limit).toHaveBeenCalledTimes(1); // preskočeno

    vi.advanceTimersByTime(IZPAD_PRESKOK_MS + 1);
    limit.mockResolvedValue({ success: false, limit: 20, remaining: 0, reset: 0 });
    expect((await rateLimit(zahteva, 'ai')).success).toBe(false); // Redis spet odloča
    expect(limit).toHaveBeenCalledTimes(2);
  });

  it('napaka Redis: spusti in preskoči naslednje', async () => {
    const { rateLimit } = await modul();
    limit.mockRejectedValue(new Error('ENOTFOUND'));
    expect((await rateLimit(zahteva, 'api')).success).toBe(true);
    expect((await rateLimit(zahteva, 'api')).success).toBe(true);
    expect(limit).toHaveBeenCalledTimes(1);
  });

  it('delujoč Redis: omejitev velja vsakič', async () => {
    const { rateLimit } = await modul();
    limit.mockResolvedValue({ success: false, limit: 5, remaining: 0, reset: 0 });
    expect((await rateLimit(zahteva, 'auth')).success).toBe(false);
    expect((await rateLimit(zahteva, 'auth')).success).toBe(false);
    expect(limit).toHaveBeenCalledTimes(2);
  });
});
