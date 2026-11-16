'use client';

/**
 * Asistent+ orb — srce vmesnika.
 *
 * Mehke konične plasti v barvah znamke (vijolična → modra → turkizna), zamegljene
 * skupaj s kontrastom ("tekoče" robove), fino zrno in steklen odsev. V jedru je
 * beli plus iz logotipa Jedro+.
 *
 * Velikost in položaj: orb je vedno narisan v 144 px, premik in velikost gresta
 * samo prek transform (translate + scale), zato je prelet 60 fps.
 *
 * Stanje (data-stanje na .ap-koren) in glasnost (--ap-nivo, useNivoGlasu) vodita CSS:
 *   mirovanje  — počasno dihanje (brez vrtenja; nič ne teče v JS);
 *   povezujem  — val (vžig) in hitro vrtenje;
 *   poslusam   — utrip z glasnostjo mikrofona;
 *   razmisljam — hitrejše tekoče vrtenje, plus se obrača po četrtinah;
 *   govorim    — utrip z glasnostjo asistentovega glasu.
 * Brez odvisnosti od shadcn; slogi so v ./asistent.css.
 */

import { useState } from 'react';
import type { StanjePogovora } from '@/lib/glas/odjemalec/pogovor';
import { markPath } from '@/lib/brand/geometry';

/** Velikost, v kateri je orb narisan (scale ga prilagodi). */
export const ORB_OSNOVA = 144;

const PLUS = markPath(100);

export interface AsistentOrbProps {
  stanje: StanjePogovora;
  x: number;
  y: number;
  velikost: number;
  /** Ključ uspeha (spremeni se ob vsakem novem uspehu); null = ni uspeha. */
  uspeh?: number | null;
  oznaka: string;
  onClick: () => void;
  /** Priprava seje vnaprej (miška nad krogcem, dotik). */
  onPripravi?: () => void;
}

export function AsistentOrb({ stanje, x, y, velikost, uspeh = null, oznaka, onClick, onPripravi }: AsistentOrbProps) {
  // Vžig ob vsakem začetku povezovanja (val se predvaja enkrat).
  const [prej, setPrej] = useState(stanje);
  const [vzig, setVzig] = useState(0);
  if (stanje !== prej) {
    setPrej(stanje);
    if (stanje === 'povezujem') setVzig((v) => v + 1);
  }

  const s = velikost / ORB_OSNOVA;
  return (
    <button
      type="button"
      className="ap-orb"
      onClick={onClick}
      onPointerEnter={onPripravi}
      onPointerDown={onPripravi}
      aria-label={oznaka}
      data-uspeh={uspeh != null ? '' : undefined}
      style={{ transform: `translate3d(${x}px, ${y}px, 0) scale(${s})` }}
    >
      <span className="ap-orb__pritisk" aria-hidden>
        <span className="ap-orb__dih">
          <span className="ap-orb__halo" />
          <span className="ap-orb__tel">
            <span className="ap-orb__pospesek">
              <span className="ap-orb__mehurcki">
                <span className="ap-orb__plast ap-orb__plast--1" />
                <span className="ap-orb__plast ap-orb__plast--2" />
                <span className="ap-orb__plast ap-orb__plast--3" />
              </span>
            </span>
            <span className="ap-orb__sijaj" />
            <span className="ap-orb__zrno" />
            <span className="ap-orb__jedro">
              <span className="ap-orb__zar" />
              <span className="ap-orb__plus">
                <span className="ap-orb__plus-vrt" style={{ display: 'block' }}>
                  <svg viewBox="0 0 100 100">
                    <path d={PLUS} fill="#fff" fillOpacity={0.94} />
                  </svg>
                </span>
              </span>
              <svg className="ap-orb__kljukica" viewBox="0 0 24 24" fill="none">
                <path d="M5 12.5l4.6 4.5L19 7.5" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="ap-orb__rob" />
          </span>
          {vzig > 0 && <span key={`v${vzig}`} className="ap-orb__val" />}
          {uspeh != null && <span key={`u${uspeh}`} className="ap-orb__val ap-orb__val--uspeh" />}
        </span>
      </span>
    </button>
  );
}
