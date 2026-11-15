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
 *
 * Različica "obris": narisan je samo rob (obroč med obliko in obliko, zamaknjeno
 * navznoter; clip-path z evenodd), po njem tečejo barve, pod njim je mehak sij.
 */

import { useEffect, useRef, useState } from 'react';
import type { StanjePogovora } from '@/lib/glas/odjemalec/pogovor';
import { DEBELINA_OBRISA, NASTAVITVE, parametri, potPlusa, zamik, type Kraki, type ParametriPlusa, type RazlicicaPlusa } from './plusOblika';

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
/** Vzmet gumice: togost (navzgor / navzdol) in dušenje (< 1 = rahlo preskoči in zaniha). */
const TOGOST_GOR = 170;
const TOGOST_DOL = 120;
const DUSENJE = 0.42;
/** Uspeh: mirnejša vzmet (komaj opazen preskok), brez migetanja krakov. */
const DUSENJE_USPEH = 0.78;
/** Preskok čez krog: plus se za trenutek še malo poveča (delež prekoračitve). */
const PRESKOK_POVECAVA = 0.5;
/** Preskok nazaj čez plus: kraki se za trenutek iztegnejo. */
const PRESKOK_KRAKI = 0.6;

/** Oblika, povečana okoli središča (preskok gumice čez krog). */
function povecaj(p: ParametriPlusa, f: number): ParametriPlusa {
  if (f === 1) return p;
  const k = p.kraki;
  return {
    kraki: { gor: k.gor * f, desno: k.desno * f, dol: k.dol * f, levo: k.levo * f },
    debelina: p.debelina * f,
    zaobljenost: p.zaobljenost * f,
    mehcanje: p.mehcanje * f,
  };
}

function obrezi(el: HTMLElement | null, pot: string) {
  if (!el) return;
  el.style.clipPath = pot;
  el.style.setProperty('-webkit-clip-path', pot);
}

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
  const sij = useRef<HTMLSpanElement | null>(null);
  const notranjost = useRef<HTMLSpanElement | null>(null);
  const obris = razlicica === 'obris';
  /** Stanje pogona med upodobitvami (brez ponovnega izrisa Reacta). */
  const pogon = useRef({ napih: 0, hitrost: 0, cas: 0, miska: 0, ciljMiska: 0, vzigOd: -1e9, sprozi: () => {} });

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

    // Pri majhnem orbu (kot) je rob obrisa malo debelejši, da je na beli podlagi viden.
    const debelinaRoba = DEBELINA_OBRISA * Math.min(1.45, Math.max(1, 66 / velikost));

    const narisi = (napih: number, raztezki: Kraki) => {
      // Gumica: napih nad 1 = krog se še malo poveča, pod 0 = kraki se iztegnejo.
      const r = napih < 0 ? -napih * PRESKOK_KRAKI : 0;
      const raz = r ? { gor: raztezki.gor + r, desno: raztezki.desno + r, dol: raztezki.dol + r, levo: raztezki.levo + r } : raztezki;
      const oblika = povecaj(parametri(n, Math.min(1, Math.max(0, napih)), raz), napih > 1 ? 1 + (napih - 1) * PRESKOK_POVECAVA : 1);
      const d = potPlusa(oblika);
      if (d === zadnja) return;
      zadnja = d;
      if (!obris) {
        obrezi(el, `path("${d}")`);
        rob.current?.setAttribute('d', d);
        return;
      }
      // Obris: ostri obroč, širši obroč za sij, notranjost.
      const notri = potPlusa(zamik(oblika, debelinaRoba));
      obrezi(el, `path(evenodd, "${d} ${notri}")`);
      obrezi(sij.current, `path(evenodd, "${potPlusa(zamik(oblika, -3))} ${potPlusa(zamik(oblika, debelinaRoba + 4))}")`);
      obrezi(notranjost.current, `path("${notri}")`);
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
      // Vzmet (gumica): rahlo preskoči cilj in zaniha nazaj.
      const dt = Math.min(0.05, Math.max(0.001, (zdaj - p.cas) / 1000));
      p.cas = zdaj;
      if (manjGibanja) {
        p.napih = cilj;
        p.hitrost = 0;
      } else {
        const togost = cilj > p.napih ? TOGOST_GOR : TOGOST_DOL;
        p.hitrost += (togost * (cilj - p.napih) - 2 * Math.sqrt(togost) * (uspesno ? DUSENJE_USPEH : DUSENJE) * p.hitrost) * dt;
        p.napih += p.hitrost * dt;
      }
      p.miska += (p.ciljMiska - p.miska) * 0.18;

      // Kraki: vsak diha zase (glas), val po vrsti (razmišljam), miška (vsi malo ven).
      const m = 0.06 * p.miska;
      const r: Kraki = { gor: m, desno: m, dol: m, levo: m };
      if (!manjGibanja && !uspesno) {
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

      const umirjeno = Math.abs(cilj - p.napih) < MIRNO && Math.abs(p.hitrost) < 0.01 && Math.abs(p.ciljMiska - p.miska) < MIRNO && vzigNapih === 0;
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
  }, [razlicica, obris, stanje, uspesno, velikost]);

  const miska = (v: number) => {
    pogon.current.ciljMiska = v;
    pogon.current.sprozi();
  };

  const s = velikost / 144;
  return (
    <button
      ref={gumb}
      type="button"
      className={`ap-orb ap-orb--plus${obris ? ' ap-orb--obris' : ''}`}
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
          {obris ? (
            <>
              <span ref={notranjost} className="ap-obris__notranjost" />
              <span className="ap-obris__sij">
                <span ref={sij} className="ap-obris__obroc">
                  <span className="ap-obris__pospesek">
                    <span className="ap-obris__barve" />
                  </span>
                </span>
              </span>
              <span ref={tel} className="ap-obris__obroc">
                <span className="ap-obris__pospesek">
                  <span className="ap-obris__barve" />
                </span>
              </span>
              <span className="ap-orb__jedro">
                <svg className="ap-orb__kljukica" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12.5l4.6 4.5L19 7.5" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </>
          ) : (
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
          )}
          {vzig > 0 && <span key={`v${vzig}`} className="ap-orb__val" />}
          {uspesno && <span key={`u${uspeh}`} className="ap-orb__val ap-orb__val--uspeh" />}
        </span>
      </span>
    </button>
  );
}
