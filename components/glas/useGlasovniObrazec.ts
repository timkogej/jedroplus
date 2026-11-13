'use client';

// Obrazec, ki ga je odprl Asistent+ (aktiven = odprt s predizpolnitvijo), sprejme
// glasovni "shrani" ali "prekliči". Shrani = requestSubmit() obrazca, torej ista
// pot kot gumb Shrani; ročno odprti obrazci se na glas ne odzivajo.

import { useEffect, useRef, type RefObject } from 'react';
import { DOGODEK_UKAZ, javiStanjeObrazca, type UkazObrazcu } from '@/lib/glas/odjemalec/obrazecGlas';

export function useGlasovniObrazec(aktiven: boolean, form: RefObject<HTMLFormElement | null>, zapri: () => void): void {
  const zapriRef = useRef(zapri);
  useEffect(() => {
    zapriRef.current = zapri;
  }, [zapri]);

  useEffect(() => {
    if (!aktiven) return;
    javiStanjeObrazca(true);
    const ob = (e: Event) => {
      const ukaz = (e as CustomEvent<{ ukaz?: UkazObrazcu }>).detail?.ukaz;
      if (ukaz === 'shrani') form.current?.requestSubmit();
      else if (ukaz === 'preklici') zapriRef.current();
    };
    window.addEventListener(DOGODEK_UKAZ, ob);
    return () => {
      window.removeEventListener(DOGODEK_UKAZ, ob);
      javiStanjeObrazca(false);
    };
  }, [aktiven, form]);
}
