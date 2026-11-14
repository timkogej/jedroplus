'use client';

/**
 * Asistent+ v obliki plusa (logotip Jedro+), ki se ob glasu napihne proti krogu.
 *
 * Isti vmesnik kot AsistentOrb (položaj in velikost samo prek transform; narisan
 * v 144 px). Notranjost je ista "tekoča" barva kot pri krogu (konične plasti,
 * zrno), obrezana z obliko plusa (clip-path: path, plusOblika.ts).
 *
 * Oblika se računa v JS (requestAnimationFrame), a samo:
 *   * med pogovorom (poslušam, razmišljam, govorim …),
 *   * med kratkim prehodom (miška nad plusom, vžig, uspeh).
 * V mirovanju, ko se oblika umiri, ne teče nič; dihanje in lesk sta CSS.
 *
 *   mirovanje  — plus, počasno dihanje, občasen lesk; miška: kraki se raztegnejo;
 *   povezujem  — plus se hitro napihne v krog in odpre nazaj (vžig);
 *   poslusam   — kraki se iztegujejo z glasom uporabnika (nežno);
 *   razmisljam — kraki utripajo po vrsti v krogu;
 *   govorim    — plus se z glasom asistenta napihuje proti krogu, kraki vsak zase;
 *   uspeh      — napihne se v krog s kljukico, nato nazaj v plus.
 * Glasnost bere iz --ap-nivo na .ap-koren (useNivoGlasu).
 */

import { useEffect, useRef, useState } from 'react';
import type { StanjePogovora } from '@/lib/glas/odjemalec/pogovor';
import { NASTAVITVE, parametri, potPlusa, type Kraki, type RazlicicaPlusa } from './plusOblika';

export interface PlusOrbProps {
  razlicica: RazlicicaPlusa;
  stanje: StanjePogovora;
  x: number;
  y: number;
  velikost: number;
  uspeh?: number | null;
  oznaka: string;
  onClick: () => void;
  onPripravi?: () => void;
}

const VZIG_MS = 820;
const MIRNO = 0.0015;

export function PlusOrb({ razlicica, stanje, x, y, velikost, uspeh = null, oznaka, onClick, onPripravi }: PlusOrbProps) {
  const [prej, setPrej] = useState(stanje);
  const [vzig, setVzig] = useState(0);
  if (stanje !== prej) {
    setPrej(stanje);
    if (stanje === 'povezujem') setVzig((v) => v + 1);
  }

  const gumb = useRef<HTMLButtonElement | null>(null);
  const tel = useRef<HTMLSpanElement | null>(null);
  const rob = useRef<SVGPathElement | null>(null);
  /** Stanje pogona med upodobitvami (brez ponovnega izrisa Reacta). */
  const pogon = useRef({ napih: 0, miska: 0, ciljMiska: 0, vzigOd: -1e9, sprozi: () => {} });

  // Vžig: zabeleži začetek (pogon ga odigra).
  useEffect(() => {
    if (vzig > 0) {
      pogon.current.vzigOd = performance.now();
      pogon.current.sprozi();
    }
  }, [vzig]);

  const uspesno = uspeh != null;

  useEffect(() => {
    const el = tel.current;
    if (!el) return;
    const n = NASTAVITVE[razlicica];
    const manjGibanja = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const koren = gumb.current?.closest<HTMLElement>('.ap-koren') ?? null;
    const p = pogon.current;
    const zivo = stanje !== 'mirovanje';
    let raf = 0;
    let zadnja = '';

    const narisi = (napih: number, raztezki: Kraki) => {
      const d = potPlusa(parametri(n, napih, raztezki));
      if (d === zadnja) return;
      zadnja = d;
      const pot = `path("${d}")`;
      el.style.clipPath = pot;
      el.style.setProperty('-webkit-clip-path', pot);
      rob.current?.setAttribute('d', d);
    };

    const korak = (zdaj: number) => {
      raf = 0;
      const c = zdaj / 1000;
      const nivo = manjGibanja ? 0 : parseFloat(koren?.style.getPropertyValue('--ap-nivo') ?? '') || 0;

      // Napihnjenost: uspeh (krog), vžig (hitro v krog in nazaj), glas.
      const tv = (zdaj - p.vzigOd) / VZIG_MS;
      const vzigNapih = !manjGibanja && tv >= 0 && tv < 1 ? Math.sin(Math.PI * tv) ** 1.4 : 0;
      // Običajen govor plus le malo napihne; do kroga gre samo ob poudarkih.
      const krivulja = nivo ** 1.7;
      const glas = stanje === 'govorim' ? krivulja * n.napihGlas : stanje === 'poslusam' ? krivulja * n.napihGlas * 0.35 : 0;
      const cilj = Math.max(uspesno ? 1 : 0, vzigNapih, glas);
      p.napih = manjGibanja ? cilj : p.napih + (cilj - p.napih) * (cilj > p.napih ? 0.34 : vzigNapih > 0 ? 0.3 : 0.1);
      p.miska += (p.ciljMiska - p.miska) * 0.18;

      // Kraki: vsak diha zase (glas), val po vrsti (razmišljam), miška (vsi malo ven).
      const m = 0.06 * p.miska;
      const r: Kraki = { gor: m, desno: m, dol: m, levo: m };
      if (!manjGibanja) {
        if (stanje === 'govorim' || stanje === 'poslusam') {
          const a = n.nesimetrija * nivo * (stanje === 'poslusam' ? 1.2 : 1);
          r.gor += a * (0.5 + 0.5 * Math.sin(c * 5.1 + 0.3));
          r.desno += a * (0.5 + 0.5 * Math.sin(c * 6.7 + 2.1));
          r.dol += a * (0.5 + 0.5 * Math.sin(c * 4.3 + 4.2));
          r.levo += a * (0.5 + 0.5 * Math.sin(c * 7.9 + 1.0));
        } else if (stanje === 'razmisljam') {
          const val = (i: number) => 0.11 * Math.max(0, Math.sin(c * 5.4 - (i * Math.PI) / 2)) ** 3;
          r.gor += val(0);
          r.desno += val(1);
          r.dol += val(2);
          r.levo += val(3);
        } else if (stanje === 'povezujem') {
          const s = 0.04 * (0.5 + 0.5 * Math.sin(c * 9));
          r.gor += s;
          r.desno += s;
          r.dol += s;
          r.levo += s;
        }
      }
      narisi(p.napih, r);

      const umirjeno = Math.abs(cilj - p.napih) < MIRNO && Math.abs(p.ciljMiska - p.miska) < MIRNO && vzigNapih === 0;
      if (zivo || !umirjeno || uspesno) raf = requestAnimationFrame(korak);
    };

    p.sprozi = () => {
      if (!raf) raf = requestAnimationFrame(korak);
    };
    korak(performance.now());
    return () => {
      if (raf) cancelAnimationFrame(raf);
      p.sprozi = () => {};
    };
  }, [razlicica, stanje, uspesno]);

  const miska = (v: number) => {
    pogon.current.ciljMiska = v;
    pogon.current.sprozi();
  };

  const s = velikost / 144;
  return (
    <button
      ref={gumb}
      type="button"
      className="ap-orb ap-orb--plus"
      data-oblika={razlicica}
      onClick={onClick}
      onPointerEnter={(e) => {
        onPripravi?.();
        if (e.pointerType === 'mouse') miska(1);
      }}
      onPointerLeave={() => miska(0)}
      onPointerDown={onPripravi}
      aria-label={oznaka}
      data-uspeh={uspesno ? '' : undefined}
      style={{ transform: `translate3d(${x}px, ${y}px, 0) scale(${s})` }}
    >
      <span className="ap-orb__pritisk" aria-hidden>
        <span className="ap-orb__dih">
          <span className="ap-orb__halo" />
          <span className="ap-plus__fokus" />
          <span className="ap-plus__senca">
            <span ref={tel} className="ap-orb__tel">
              <span className="ap-orb__pospesek">
                <span className="ap-orb__mehurcki">
                  <span className="ap-orb__plast ap-orb__plast--1" />
                  <span className="ap-orb__plast ap-orb__plast--2" />
                  <span className="ap-orb__plast ap-orb__plast--3" />
                </span>
              </span>
              <span className="ap-orb__sijaj" />
              <span className="ap-plus__lesk" />
              <span className="ap-orb__zrno" />
              <span className="ap-orb__jedro">
                <span className="ap-orb__zar" />
                <svg className="ap-orb__kljukica" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12.5l4.6 4.5L19 7.5" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <svg className="ap-plus__rob" viewBox="0 0 144 144">
                <path ref={rob} />
              </svg>
            </span>
          </span>
          {vzig > 0 && <span key={`v${vzig}`} className="ap-orb__val" />}
          {uspesno && <span key={`u${uspeh}`} className="ap-orb__val ap-orb__val--uspeh" />}
        </span>
      </span>
    </button>
  );
}
