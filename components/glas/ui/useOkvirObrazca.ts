'use client';

/**
 * Obrazec, ki ga je odprl asistent (samo takrat; ročno odprti ostanejo nespremenjeni):
 *
 *   * list dobi gradientni rob in sij ([data-ap-list]); lastno ozadje obrazca
 *     postane prozorno ([data-ap-ozadje]), zamegli ga tančica asistenta pod listom;
 *   * polja, ki jih izpolni asistent, se nežno zasvetijo: ob odprtju po vrsti
 *     ("pisanje"), kasneje vsako polje, ki se spremeni brez uporabnikovega dotika
 *     (glasovno dopolnjevanje "pri Luki", "v ponedeljek");
 *   * javi oddajo obrazca (gumb Shrani ali requestSubmit), da vmesnik pokaže uspeh.
 *
 * Obrazca ne spreminja: samo atributi in razred za animacijo, ki se ob zaprtju
 * odstranijo. Shranjevanje teče po obstoječi poti obrazca.
 */

import { useEffect, useRef, useState } from 'react';
import type { Pravokotnik } from '@/lib/glas/odjemalec/polozaj';

/** Polja, ki jih spremljamo (vrednost) — gumbi samo po besedilu (npr. izbirniki). */
const POLJA = 'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit]), select, textarea, button';
/** Po dotiku/tipki uporabnika sprememb nekaj časa ne pripisujemo asistentu. */
const DOTIK_MS = 1200;
const PREVERI_MS = 250;
const ZACETEK_MS = 380;
const ZAMIK_MS = 110;

/** List (panel) obrazca: najvišji prednik, ki ne pokriva celega zaslona (ozadje). */
export function najdiList(el: HTMLElement): HTMLElement {
  let p = el;
  while (p.parentElement && p.parentElement !== document.body) {
    if (pokrivaZaslon(p.parentElement)) break;
    p = p.parentElement;
  }
  return p;
}

/** Pokriva ves vidni del okna (clientWidth: brez drsnika, sicer fixed inset-0 ne šteje). */
function pokrivaZaslon(el: Element): boolean {
  const r = el.getBoundingClientRect();
  const d = document.documentElement;
  return r.width >= Math.min(window.innerWidth, d.clientWidth) - 1 && r.height >= Math.min(window.innerHeight, d.clientHeight) - 1;
}

function vrednost(p: HTMLElement): string {
  if (p instanceof HTMLInputElement || p instanceof HTMLSelectElement || p instanceof HTMLTextAreaElement) return p.value;
  const t = (p.textContent ?? '').replace(/\s+/g, ' ').trim();
  // Gumbi brez besedila (ikone) in dolgi gumbi (seznami) niso polja.
  return t.length > 80 ? '' : t;
}

function zasveti(p: HTMLElement) {
  p.classList.remove('ap-polje-sij');
  void p.offsetWidth; // ponovni zagon animacije
  p.classList.add('ap-polje-sij');
}

export function useOkvirObrazca(el: HTMLElement | null, aktiven: boolean, poslano?: (form: HTMLFormElement) => void): void {
  const poslanoRef = useRef(poslano);
  useEffect(() => {
    poslanoRef.current = poslano;
  });

  useEffect(() => {
    if (!aktiven || !el || !el.isConnected) return;
    const list = najdiList(el);
    const koren = list.parentElement && list.parentElement !== document.body ? list.parentElement : null;
    const ozadja: HTMLElement[] = [];
    if (koren) {
      for (const s of Array.from(koren.children)) {
        if (s !== list && s instanceof HTMLElement && pokrivaZaslon(s)) ozadja.push(s);
      }
      // Ozadje je lahko kar koren (list je njegov edini otrok).
      if (!ozadja.length && pokrivaZaslon(koren)) ozadja.push(koren);
    }
    list.setAttribute('data-ap-list', '');
    const relativen = getComputedStyle(list).position === 'static';
    if (relativen) list.style.position = 'relative';
    ozadja.forEach((o) => o.setAttribute('data-ap-ozadje', ''));

    let dotik = 0;
    const ob = () => {
      dotik = performance.now();
    };
    const oddaja = (e: Event) => {
      if (e.target instanceof HTMLFormElement) poslanoRef.current?.(e.target);
    };
    const konec = (e: AnimationEvent) => {
      if (e.animationName === 'ap-polje' && e.target instanceof HTMLElement) e.target.classList.remove('ap-polje-sij');
    };
    list.addEventListener('pointerdown', ob, true);
    list.addEventListener('keydown', ob, true);
    list.addEventListener('input', ob, true);
    list.addEventListener('submit', oddaja, true);
    list.addEventListener('animationend', konec, true);

    const prej = new Map<HTMLElement, string>();
    const casovniki: number[] = [];
    // Ob odprtju: izpolnjena polja se zasvetijo po vrsti (asistent "piše").
    casovniki.push(
      window.setTimeout(() => {
        let i = 0;
        for (const p of Array.from(list.querySelectorAll<HTMLElement>(POLJA))) {
          const v = vrednost(p);
          prej.set(p, v);
          const jePolje = !(p instanceof HTMLButtonElement) || p.hasAttribute('aria-haspopup') || p.hasAttribute('aria-expanded');
          if (v && jePolje && !p.closest('[data-ap-brez-sija]')) casovniki.push(window.setTimeout(() => zasveti(p), i++ * ZAMIK_MS));
        }
      }, ZACETEK_MS)
    );
    // Kasneje: polje, ki se spremeni brez dotika, je dopolnil asistent.
    const preveri = window.setInterval(() => {
      if (!prej.size) return;
      const dotaknjen = performance.now() - dotik < DOTIK_MS;
      for (const p of Array.from(list.querySelectorAll<HTMLElement>(POLJA))) {
        const v = vrednost(p);
        const bilo = prej.get(p);
        prej.set(p, v);
        if (bilo === undefined || bilo === v || dotaknjen || !v) continue;
        zasveti(p);
      }
    }, PREVERI_MS);

    return () => {
      casovniki.forEach((c) => window.clearTimeout(c));
      window.clearInterval(preveri);
      list.removeEventListener('pointerdown', ob, true);
      list.removeEventListener('keydown', ob, true);
      list.removeEventListener('input', ob, true);
      list.removeEventListener('submit', oddaja, true);
      list.removeEventListener('animationend', konec, true);
      list.removeAttribute('data-ap-list');
      if (relativen) list.style.position = '';
      ozadja.forEach((o) => o.removeAttribute('data-ap-ozadje'));
      list.querySelectorAll('.ap-polje-sij').forEach((p) => p.classList.remove('ap-polje-sij'));
    };
  }, [el, aktiven]);
}

/** Položaj lista obrazca (med animacijo odpiranja, ob spremembi velikosti). */
export function useListObrazca(el: HTMLElement | null, odprt: boolean): Pravokotnik | null {
  const [panel, setPanel] = useState<Pravokotnik | null>(null);
  useEffect(() => {
    if (!odprt) {
      setPanel(null);
      return;
    }
    if (!el || !el.isConnected) {
      setPanel({ left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight });
      return;
    }
    const list = najdiList(el);
    const izmeri = () => {
      if (!list.isConnected) return;
      const r = list.getBoundingClientRect();
      setPanel((prej) =>
        prej && Math.abs(prej.left - r.left) < 1 && Math.abs(prej.top - r.top) < 1 && Math.abs(prej.bottom - r.bottom) < 1
          ? prej
          : { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
      );
    };
    izmeri();
    const casi = [80, 200, 400, 700].map((ms) => window.setTimeout(izmeri, ms));
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(izmeri) : null;
    ro?.observe(list);
    window.addEventListener('resize', izmeri);
    return () => {
      casi.forEach((c) => window.clearTimeout(c));
      ro?.disconnect();
      window.removeEventListener('resize', izmeri);
    };
  }, [el, odprt]);
  return panel;
}
