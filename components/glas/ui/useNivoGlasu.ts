'use client';

/**
 * Glasnost → CSS spremenljivka --ap-nivo (0–1) na korenu vmesnika.
 *
 * Teče samo med poslušanjem in govorom (requestAnimationFrame) in še kratek čas
 * po tem, da nivo mehko pade na 0. V mirovanju ne teče nič. Pri
 * prefers-reduced-motion ostane 0.
 */

import { useEffect, type RefObject } from 'react';
import type { StanjePogovora } from '@/lib/glas/odjemalec/pogovor';

export type Glasnost = () => { vhod: number; izhod: number };

/** RMS → 0–1 (koren, da tihi glas še vidno utripa). */
export function normaliziraj(rms: number, tiho: number, glasno: number): number {
  const x = (rms - tiho) / (glasno - tiho);
  return Math.pow(Math.min(1, Math.max(0, x)), 0.65);
}

export function useNivoGlasu(koren: RefObject<HTMLElement | null>, stanje: StanjePogovora, glasnost?: Glasnost): void {
  useEffect(() => {
    const el = koren.current;
    if (!el) return;
    const manjGibanja = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const zivo = (stanje === 'poslusam' || stanje === 'govorim') && Boolean(glasnost) && !manjGibanja;
    let n = parseFloat(el.style.getPropertyValue('--ap-nivo')) || 0;
    if (!zivo && n < 0.01) {
      el.style.setProperty('--ap-nivo', '0');
      return;
    }
    let raf = 0;
    let zapisano = '';
    const korak = () => {
      let cilj = 0;
      if (zivo && glasnost) {
        const g = glasnost();
        cilj = stanje === 'govorim' ? normaliziraj(g.izhod, 0.004, 0.2) : normaliziraj(g.vhod, 0.006, 0.09);
      }
      // Hiter vzpon, počasen padec (kot VU-meter).
      n += (cilj - n) * (cilj > n ? 0.32 : 0.08);
      if (!zivo && n < 0.01) n = 0;
      const v = n.toFixed(3);
      if (v !== zapisano) {
        el.style.setProperty('--ap-nivo', v);
        zapisano = v;
      }
      if (zivo || n > 0) raf = requestAnimationFrame(korak);
    };
    raf = requestAnimationFrame(korak);
    return () => cancelAnimationFrame(raf);
  }, [koren, stanje, glasnost]);
}
