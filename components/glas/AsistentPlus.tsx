'use client';

/**
 * Asistent+ — plavajoči glasovni asistent na vseh straneh.
 *
 * Živi v skupni postavitvi (app/[locale]/layout.tsx), zato pogovor ostane odprt,
 * ko asistent premakne uporabnika na drugo stran (koledar, stranke …).
 *
 * Krogec (docs/glasovni-asistent-pogovor.md):
 *   * mirovanje: spodaj desno; tap = pogovor;
 *   * pogovor: na sredini zaslona, pod njim napisi, možnosti, predlog, vnos besedila.
 *     Pogovor teče sam (posluša, odgovori, posluša naprej); konec = tap, »hvala, to je
 *     vse« ali tišina;
 *   * obrazec, ki ga je odprl asistent: krogec v zgornjem levem kotu lista (ne prekrije
 *     polj in gumba Shrani). »Ja/shrani« = requestSubmit (isto kot gumb), asistent pove
 *     izid. Po prestavitvi vpraša »Obvestim stranko?« — »ja« = isti gumb Pošlji.
 *     Asistent sam ne shrani in ne pošlje ničesar.
 *
 * Prikaže se samo prijavljenim z vklopljenim Asistent+ in pravico (/api/glas/stanje).
 * Ne zapisuje prepisov v konzolo (osebni podatki).
 *
 * Videz (orb, tančica, sij roba, napisi, okvir obrazca) je v components/glas/ui/*;
 * ta datoteka ima samo logiko in ga sestavi (AsistentVmesnik).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { besedila } from '@/lib/glas/odjemalec/jezikOdjemalca';
import { usePathname, useRouter } from '@/i18n/navigation';
import { DOGODEK_NASTAVITVE_ASISTENTA } from '@/lib/glas/odjemalec/nastavitve';
import { Pogovor, type OdgovorOdjemalec, type StanjePogovora } from '@/lib/glas/odjemalec/pogovor';
import { shraniObrazec } from '@/lib/glas/odjemalec/predizpolnitev';
import {
  DOGODEK_IZID,
  DOGODEK_STANJE,
  napakaVObrazcu,
  posljiPojdi,
  posljiUkazObrazcu,
  ukazObrazcu,
  type IzidObrazca,
  type StanjeObrazca,
} from '@/lib/glas/odjemalec/obrazecGlas';
import type { NacinKrogca, Okno } from '@/lib/glas/odjemalec/polozaj';
import { AsistentVmesnik } from './ui/AsistentVmesnik';
import { useListObrazca } from './ui/useOkvirObrazca';
import type { Vrstica } from './ui/tipi';

/** Strani, kjer asistenta ni (prijava, registracija, testna stran ima svojega). */
const BREZ = /^\/(login|signup|forgot-password|logout|auth|onboarding|glas-test|glas-dizajn)(\/|$)/;
/** Ko je obrazec odprt za pregled, posluša dlje kot običajno (8 s). */
const TISINA_OBRAZEC_MS = 30_000;
const TISINA_OBICAJNO_MS = 8_000;
/** Izid "shrani" velja, če se obrazec zapre v tem času. */
const SHRANI_OKNO_MS = 20_000;
/** Najave (izid + naslednje vprašanje) združimo v en stavek. */
const NAJAVA_ZDRUZI_MS = 450;
/** Pripravljena seja velja 5 min; osvežimo jo, dokler je zavihek viden. */
const PRIPRAVA_OSVEZI_MS = 3.5 * 60_000;
/** Napaka po koncu pogovora ostane vidna toliko časa. */
const NAPIS_MS = 6000;
/** Trenutek uspeha (kljukica v orbu, napis) traja toliko časa. */
const USPEH_MS = 2600;
/** Oddaja obrazca v tem času po glasovnem "shrani" je glasovna (napake javi useGlasovniObrazec). */
const GLASOVNO_OKNO_MS = 1500;
/** Po ročni oddaji preverjamo napake v obrazcu toliko časa. */
const PREVERJAJ_ROCNO_MS = 12_000;

// Izgovorjeni izidi so v jeziku pogovora (jezikOdjemalca, nastavi ga seja).

type OdprtObrazec = { el: HTMLElement | null; vprasanje?: string };

/** Varni robovi zaslona (iPhone) iz CSS env(). */
function varniRobovi(): { zgoraj: number; spodaj: number } {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
  document.body.appendChild(d);
  const cs = getComputedStyle(d);
  const r = { zgoraj: parseFloat(cs.paddingTop) || 0, spodaj: parseFloat(cs.paddingBottom) || 0 };
  d.remove();
  return r;
}

export function AsistentPlus() {
  const t = useTranslations('layout.asistent');
  const pot = usePathname();
  const router = useRouter();
  const [na_voljo, setNaVoljo] = useState(false);
  const [s, setS] = useState<StanjePogovora>('mirovanje');
  const [slisano, setSlisano] = useState('');
  const [vrstice, setVrstice] = useState<Vrstica[]>([]);
  const [zadnji, setZadnji] = useState<OdgovorOdjemalec | null>(null);
  const [obrazec, setObrazec] = useState<OdprtObrazec | null>(null);
  const [okno, setOkno] = useState<Okno | null>(null);
  const [napis, setNapis] = useState<string | null>(null);
  const [uspeh, setUspeh] = useState<{ kljuc: number; besedilo: string } | null>(null);
  const panel = useListObrazca(obrazec?.el ?? null, Boolean(obrazec));
  const pogovor = useRef<Pogovor | null>(null);
  const potRef = useRef(pot);
  const obrazecRef = useRef<OdprtObrazec | null>(null);
  const shranjujeOd = useRef(0);
  const zadnjiObrazec = useRef<OdgovorOdjemalec['obrazec'] | null>(null);
  const najave = useRef<string[]>([]);
  const najavaCasovnik = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Zadnja izgovorjena najava (že v vrsticah; obvestilo je ne doda znova). */
  const zadnjaNajava = useRef('');
  const preverjeno = useRef(false);
  const rocnoPreverjanje = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pogovor se ustvari enkrat; prevode in pot bere prek refov (sicer bi se ob
  // spremembi ustvaril znova in prekinil).
  const tRef = useRef(t);
  useEffect(() => {
    potRef.current = pot;
    tRef.current = t;
  }, [pot, t]);

  // Ali je asistent na voljo (prijava, vklop, pravica). Ob neuspehu preverimo
  // znova ob naslednji strani (npr. po prijavi).
  const [preveriZnova, setPreveriZnova] = useState(0);
  useEffect(() => {
    const ob = () => {
      preverjeno.current = false;
      setPreveriZnova((n) => n + 1);
    };
    window.addEventListener(DOGODEK_NASTAVITVE_ASISTENTA, ob);
    return () => window.removeEventListener(DOGODEK_NASTAVITVE_ASISTENTA, ob);
  }, []);
  useEffect(() => {
    if (BREZ.test(pot) || preverjeno.current) return;
    let preklic = false;
    fetch('/api/glas/stanje', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { ok?: boolean; vklopljeno?: boolean; pravica?: boolean } | null) => {
        if (preklic) return;
        const da = Boolean(j?.ok && j.vklopljeno && j.pravica);
        preverjeno.current = da;
        setNaVoljo(da);
      })
      .catch(() => {});
    return () => {
      preklic = true;
    };
  }, [pot, preveriZnova]);

  const dodaj = useCallback((v: Vrstica) => setVrstice((x) => [...x.slice(-12), v]), []);

  /** Izid in naslednje vprašanje ("Shranjeno. Obvestim stranko?") v enem stavku. */
  const najavi = useCallback(
    (besedilo: string, vrsta: Vrstica['kdo'] = 'asistent') => {
      dodaj({ kdo: vrsta, besedilo });
      najave.current.push(besedilo);
      if (najavaCasovnik.current) clearTimeout(najavaCasovnik.current);
      najavaCasovnik.current = setTimeout(() => {
        najavaCasovnik.current = null;
        const vse = najave.current.join(' ');
        najave.current = [];
        zadnjaNajava.current = vse;
        void pogovor.current?.povejObvestilo(vse);
      }, NAJAVA_ZDRUZI_MS);
    },
    [dodaj]
  );

  const premakni = useCallback(
    (o: OdgovorOdjemalec) => {
      if (!o.pojdi) return;
      if (o.obrazec) {
        shraniObrazec(o.obrazec);
        zadnjiObrazec.current = o.obrazec;
        // Obrazec je morda že odprt: naslednji ukaz ga dopolni.
        if (pogovor.current && obrazecRef.current && !obrazecRef.current.vprasanje) pogovor.current.kontekstObrazca = o.obrazec;
      }
      const [cilj] = o.pojdi.split('?');
      // Ista stran se ne naloži znova: namen pošljemo kot dogodek.
      if (cilj === potRef.current) posljiPojdi(o.pojdi);
      else router.push(o.pojdi);
    },
    [router]
  );

  useEffect(() => {
    if (!na_voljo) return;
    pogovor.current = new Pogovor({
      stanje: (n) => {
        setS(n);
        if (n !== 'poslusam') setSlisano('');
      },
      slisano: setSlisano,
      izjava: (x) => {
        setSlisano('');
        // Nadaljevanje izjave (premor sredi stavka) zamenja prejšnjo vrstico.
        setVrstice((v) => {
          const zadnja = v[v.length - 1];
          if (zadnja?.kdo === 'jaz' && x.startsWith(zadnja.besedilo)) return [...v.slice(0, -1), { kdo: 'jaz', besedilo: x }];
          return [...v.slice(-12), { kdo: 'jaz', besedilo: x }];
        });
      },
      odgovor: (o) => {
        setZadnji(o);
        // S kartico (številke, seznam) je v glavni vrstici samo kratek naslov.
        if (o.prikaz?.naslov || o.odgovor) dodaj({ kdo: 'asistent', besedilo: o.prikaz?.naslov ?? o.odgovor! });
        premakni(o);
      },
      potrditev: (o) => {
        setZadnji(null);
        dodaj({ kdo: o.ok ? 'asistent' : 'napaka', besedilo: o.sporocilo });
      },
      napaka: (x) => {
        setZadnji(null);
        dodaj({ kdo: 'napaka', besedilo: x });
        if (pogovor.current?.stanje === 'mirovanje' || !pogovor.current) setNapis(x);
      },
      obvestilo: (x) => {
        // Najave so že v vrsticah (najavi); "Prosim." ipd. dodamo tu.
        if (x === zadnjaNajava.current) return;
        dodaj({ kdo: 'asistent', besedilo: x });
      },
      meritev: () => {},
      lokalno: (izjava) => {
        const o = obrazecRef.current;
        if (!o) return null;
        const ukaz = ukazObrazcu(izjava);
        if (!ukaz) return null;
        if (ukaz === 'shrani') {
          // Izid pove obrazec: zaprtje (shranjeno) ali napaka v polju.
          shranjujeOd.current = Date.now();
          posljiUkazObrazcu('shrani');
          return { caka: true };
        }
        posljiUkazObrazcu('preklici');
        const govor = o.vprasanje ? besedila().neObvescam : besedila().zaprto;
        return { govor };
      },
    });
    // Seja vnaprej: ob tapu so ključa in namigi že pripravljeni (brez mikrofona).
    pogovor.current.pripravi();
    const osvezi = () => {
      if (document.visibilityState === 'visible') pogovor.current?.pripravi();
    };
    const casovnik = window.setInterval(osvezi, PRIPRAVA_OSVEZI_MS);
    document.addEventListener('visibilitychange', osvezi);
    return () => {
      window.clearInterval(casovnik);
      document.removeEventListener('visibilitychange', osvezi);
      pogovor.current?.ustavi();
      pogovor.current = null;
    };
  }, [na_voljo, dodaj, premakni]);

  // Obrazec ali vprašanje, ki ga je odprl asistent, javi odprtje/zaprtje (useGlasovniObrazec).
  useEffect(() => {
    const ob = (e: Event) => {
      const d = (e as CustomEvent<StanjeObrazca>).detail ?? { odprt: false };
      const p = pogovor.current;
      if (d.odprt) {
        const novo: OdprtObrazec = { el: d.el ?? null, vprasanje: d.vprasanje };
        obrazecRef.current = novo;
        setObrazec(novo);
        if (p) {
          p.tisinaPoOdgovoru = TISINA_OBRAZEC_MS;
          // Asistent ve, kateri obrazec je odprt, in ga z naslednjim ukazom dopolni.
          p.kontekstObrazca = d.vprasanje ? null : (zadnjiObrazec.current ?? null);
        }
        if (d.vprasanje) najavi(d.vprasanje);
        return;
      }
      const bil = obrazecRef.current;
      obrazecRef.current = null;
      setObrazec(null);
      if (p) {
        p.tisinaPoOdgovoru = TISINA_OBICAJNO_MS;
        p.kontekstObrazca = null;
      }
      if (rocnoPreverjanje.current) clearInterval(rocnoPreverjanje.current);
      rocnoPreverjanje.current = null;
      if (shranjujeOd.current && Date.now() - shranjujeOd.current < SHRANI_OKNO_MS) {
        const besedilo = bil?.vprasanje ? besedila().poslano : ((besedila().uspeh as Record<string, string>)[zadnjiObrazec.current?.vrsta ?? ''] ?? besedila().shranjeno);
        najavi(besedilo, 'uspeh');
        setUspeh((u) => ({ kljuc: (u?.kljuc ?? 0) + 1, besedilo }));
      }
      shranjujeOd.current = 0;
    };
    const izid = (e: Event) => {
      const d = (e as CustomEvent<IzidObrazca>).detail;
      if (!shranjujeOd.current || !d) return;
      shranjujeOd.current = 0;
      najavi(d.napaka ? `${besedila().niShranjeno} ${d.napaka}` : besedila().preveri, 'napaka');
    };
    window.addEventListener(DOGODEK_STANJE, ob);
    window.addEventListener(DOGODEK_IZID, izid);
    return () => {
      window.removeEventListener(DOGODEK_STANJE, ob);
      window.removeEventListener(DOGODEK_IZID, izid);
    };
  }, [najavi]);

  // Velikost zaslona in varni robovi.
  useEffect(() => {
    if (!na_voljo) return;
    const izmeri = () => setOkno({ w: window.innerWidth, h: window.innerHeight, ...varniRobovi() });
    izmeri();
    window.addEventListener('resize', izmeri);
    return () => window.removeEventListener('resize', izmeri);
  }, [na_voljo]);

  // Napaka po koncu pogovora (npr. mikrofon ni dovoljen) ostane vidna nekaj sekund.
  useEffect(() => {
    if (!napis) return;
    const c = window.setTimeout(() => setNapis(null), NAPIS_MS);
    return () => window.clearTimeout(c);
  }, [napis]);

  // Trenutek uspeha je kratek.
  useEffect(() => {
    if (!uspeh) return;
    const c = window.setTimeout(() => setUspeh(null), USPEH_MS);
    return () => window.clearTimeout(c);
  }, [uspeh]);

  useEffect(
    () => () => {
      if (rocnoPreverjanje.current) clearInterval(rocnoPreverjanje.current);
    },
    []
  );

  /**
   * Obrazec je oddan. Glasovni "shrani" (requestSubmit) ima izid že urejen
   * (useGlasovniObrazec). Ročni gumb Shrani: zaprtje = uspeh, napaka v polju = asistent
   * jo pove. Shranjevanje teče po poti obrazca; tu samo opazujemo.
   */
  const poslano = useCallback(
    (form: HTMLFormElement) => {
      if (shranjujeOd.current && Date.now() - shranjujeOd.current < GLASOVNO_OKNO_MS) return;
      shranjujeOd.current = Date.now();
      if (rocnoPreverjanje.current) clearInterval(rocnoPreverjanje.current);
      const zacetek = Date.now();
      rocnoPreverjanje.current = setInterval(() => {
        const ustavi = () => {
          if (rocnoPreverjanje.current) clearInterval(rocnoPreverjanje.current);
          rocnoPreverjanje.current = null;
        };
        if (!form.isConnected) return ustavi();
        const napaka = napakaVObrazcu(form);
        if (napaka) {
          ustavi();
          shranjujeOd.current = 0;
          if (pogovor.current?.aktiven) najavi(`${besedila().niShranjeno} ${napaka}`, 'napaka');
        } else if (Date.now() - zacetek > PREVERJAJ_ROCNO_MS) {
          ustavi();
          shranjujeOd.current = 0;
        }
      }, 300);
    },
    [najavi]
  );

  const aktiven = s !== 'mirovanje';
  const glasnost = useCallback(() => pogovor.current?.glasnost() ?? { vhod: 0, izhod: 0 }, []);
  const pripravi = useCallback(() => pogovor.current?.pripravi(), []);
  const koncaj = useCallback(() => pogovor.current?.ustavi(), []);

  // Esc konča pogovor (računalnik).
  useEffect(() => {
    if (!aktiven) return;
    const tipka = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !obrazecRef.current) pogovor.current?.ustavi();
    };
    window.addEventListener('keydown', tipka);
    return () => window.removeEventListener('keydown', tipka);
  }, [aktiven]);

  if (!na_voljo || BREZ.test(pot) || !okno) return null;

  const nacin: NacinKrogca = obrazec ? 'obrazec' : aktiven ? 'sredina' : 'kot';

  const tap = () => {
    const p = pogovor.current;
    if (!p) return;
    setNapis(null);
    if (s === 'mirovanje') {
      setVrstice([]);
      setZadnji(null);
      void p.zacni();
    } else if (s === 'govorim') p.prekini();
    else p.ustavi();
  };

  return (
    <AsistentVmesnik
      stanje={s}
      nacin={nacin}
      okno={okno}
      panel={panel}
      obrazecEl={obrazec?.el ?? null}
      slisano={slisano}
      vrstice={vrstice.slice(-4)}
      zadnji={zadnji}
      napis={napis}
      uspeh={uspeh}
      glasnost={glasnost}
      t={t}
      onTap={tap}
      onPripravi={pripravi}
      onKoncaj={koncaj}
      onBesedilo={(x) => void pogovor.current?.besedilo(x)}
      onIzberi={(m) => void pogovor.current?.izberi(m)}
      onPotrdi={() => void pogovor.current?.potrdiPredlog()}
      onZavrni={() => void pogovor.current?.zavrniPredlog()}
      onPoslano={poslano}
    />
  );
}
