'use client';

// Obrazec (ali vprašanje), ki ga je odprl Asistent+ (aktiven = odprt z glasom), sprejme
// glasovni "shrani" ali "prekliči".
//   * Obrazec: shrani = requestSubmit(), torej ista pot kot gumb Shrani. Če obrazec
//     ostane odprt z napako v polju, asistent napako pove (javiIzidObrazca).
//   * Vprašanje brez obrazca ("Obvestim stranko?"): `potrdi` = isti gumb kot dotik.
// Ročno odprti obrazci se na glas ne odzivajo.

import { useEffect, useRef, type RefObject } from 'react';
import { DOGODEK_UKAZ, javiIzidObrazca, javiStanjeObrazca, napakaVObrazcu, type UkazObrazcu } from '@/lib/glas/odjemalec/obrazecGlas';

/** Po "shrani" preverjamo napake v obrazcu toliko časa (shranjevanje prek n8n traja). */
const PREVERJAJ_MS = 12_000;

export function useGlasovniObrazec(
  aktiven: boolean,
  el: RefObject<HTMLElement | null>,
  zapri: () => void,
  moznosti?: { potrdi?: () => void; vprasanje?: string; uspeh?: string }
): void {
  const zapriRef = useRef(zapri);
  const potrdiRef = useRef(moznosti?.potrdi);
  useEffect(() => {
    zapriRef.current = zapri;
    potrdiRef.current = moznosti?.potrdi;
  });
  const vprasanje = moznosti?.vprasanje;
  const uspeh = moznosti?.uspeh;

  useEffect(() => {
    if (!aktiven) return;
    javiStanjeObrazca({ odprt: true, el: el.current, vprasanje, uspeh });
    let preverjanje: ReturnType<typeof setInterval> | null = null;
    const ustavi = () => {
      if (preverjanje) clearInterval(preverjanje);
      preverjanje = null;
    };
    const ob = (e: Event) => {
      const ukaz = (e as CustomEvent<{ ukaz?: UkazObrazcu }>).detail?.ukaz;
      if (ukaz === 'preklici') return zapriRef.current();
      if (ukaz !== 'shrani') return;
      if (potrdiRef.current) return potrdiRef.current();
      const form = el.current;
      if (!(form instanceof HTMLFormElement)) return;
      form.requestSubmit();
      // Zaprtje obrazca = shranjeno (javi cleanup spodaj). Napaka v polju ali
      // obrazec, ki ostane odprt, pa gre asistentu, da jo pove.
      ustavi();
      const zacetek = Date.now();
      preverjanje = setInterval(() => {
        if (!form.isConnected) return ustavi();
        const napaka = napakaVObrazcu(form);
        if (napaka) {
          ustavi();
          javiIzidObrazca({ ok: false, napaka });
        } else if (Date.now() - zacetek > PREVERJAJ_MS) {
          ustavi();
          javiIzidObrazca({ ok: false, napaka: null });
        }
      }, 300);
    };
    window.addEventListener(DOGODEK_UKAZ, ob);
    return () => {
      ustavi();
      window.removeEventListener(DOGODEK_UKAZ, ob);
      javiStanjeObrazca(false);
    };
  }, [aktiven, el, vprasanje, uspeh]);
}
