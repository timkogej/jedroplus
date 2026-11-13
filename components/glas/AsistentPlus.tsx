'use client';

/**
 * Asistent+ — plavajoči glasovni asistent na vseh straneh (faza 4).
 *
 * Živi v skupni postavitvi (app/[locale]/layout.tsx), zato pogovor ostane odprt,
 * ko asistent premakne uporabnika na drugo stran (koledar, stranke …).
 *
 *   * Krogec spodaj desno: tap = pogovor (posluša, odgovori z glasom, posluša naprej).
 *   * Mehurček nad njim: slišano, odgovor, možnosti, predlog s potrditvijo, vnos besedila.
 *   * Ko asistent odpre obrazec, se skrči v pilulo na vrhu (dno lista z gumbom
 *     Shrani ostane prosto); »shrani« / »prekliči« gre obrazcu (requestSubmit =
 *     gumb Shrani). Asistent sam ne shrani ničesar.
 *
 * Prikaže se samo prijavljenim z vklopljenim Asistent+ in pravico (/api/glas/stanje).
 * Ne zapisuje prepisov v konzolo (osebni podatki).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Microphone, PaperPlaneRight, SpeakerHigh, Stop, X, Check } from '@phosphor-icons/react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { Pogovor, type OdgovorOdjemalec, type StanjePogovora } from '@/lib/glas/odjemalec/pogovor';
import { shraniObrazec } from '@/lib/glas/odjemalec/predizpolnitev';
import { DOGODEK_STANJE, posljiPojdi, posljiUkazObrazcu, ukazObrazcu } from '@/lib/glas/odjemalec/obrazecGlas';

/** Strani, kjer asistenta ni (prijava, registracija, testna stran ima svojega). */
const BREZ = /^\/(login|signup|forgot-password|logout|auth|onboarding|glas-test)(\/|$)/;
/** Ko je obrazec odprt za pregled, posluša dlje kot običajno (8 s). */
const TISINA_OBRAZEC_MS = 30_000;
const TISINA_OBICAJNO_MS = 8_000;
/** "Shranjeno" pokažemo, če se obrazec po glasovnem "shrani" zapre v tem času. */
const SHRANI_OKNO_MS = 20_000;

type Vrstica = { kdo: 'jaz' | 'asistent' | 'napaka'; besedilo: string };

export function AsistentPlus() {
  const t = useTranslations('layout.asistent');
  const pot = usePathname();
  const router = useRouter();
  const [na_voljo, setNaVoljo] = useState(false);
  const [odprt, setOdprt] = useState(false);
  const [s, setS] = useState<StanjePogovora>('mirovanje');
  const [slisano, setSlisano] = useState('');
  const [vrstice, setVrstice] = useState<Vrstica[]>([]);
  const [zadnji, setZadnji] = useState<OdgovorOdjemalec | null>(null);
  const [besedilo, setBesedilo] = useState('');
  const [obrazecOdprt, setObrazecOdprt] = useState(false);
  const pogovor = useRef<Pogovor | null>(null);
  const potRef = useRef(pot);
  const obrazecRef = useRef(false);
  const shranjujeOd = useRef(0);
  const zadnjiObrazec = useRef<OdgovorOdjemalec['obrazec'] | null>(null);
  const konec = useRef<HTMLDivElement | null>(null);
  const preverjeno = useRef(false);

  // Pogovor se ustvari enkrat; prevode in pot bere prek refov (sicer bi se ob
  // spremembi ustvaril znova in prekinil).
  const tRef = useRef(t);
  useEffect(() => {
    potRef.current = pot;
    tRef.current = t;
  }, [pot, t]);

  // Ali je asistent na voljo (prijava, vklop, pravica). Ob neuspehu preverimo
  // znova ob naslednji strani (npr. po prijavi).
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
  }, [pot]);

  const dodaj = useCallback((v: Vrstica) => setVrstice((x) => [...x.slice(-12), v]), []);

  const premakni = useCallback(
    (o: OdgovorOdjemalec) => {
      if (!o.pojdi) return;
      if (o.obrazec) {
        shraniObrazec(o.obrazec);
        zadnjiObrazec.current = o.obrazec;
        // Obrazec je morda že odprt: naslednji ukaz ga dopolni.
        if (pogovor.current && obrazecRef.current) pogovor.current.kontekstObrazca = o.obrazec;
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
        dodaj({ kdo: 'jaz', besedilo: x });
      },
      odgovor: (o) => {
        setZadnji(o);
        if (o.odgovor) dodaj({ kdo: 'asistent', besedilo: o.odgovor });
        premakni(o);
      },
      potrditev: (o) => {
        setZadnji(null);
        dodaj({ kdo: o.ok ? 'asistent' : 'napaka', besedilo: o.sporocilo });
      },
      napaka: (x) => {
        setZadnji(null);
        dodaj({ kdo: 'napaka', besedilo: x });
      },
      meritev: () => {},
      lokalno: (izjava) => {
        if (!obrazecRef.current) return null;
        const ukaz = ukazObrazcu(izjava);
        if (!ukaz) return null;
        if (ukaz === 'shrani') shranjujeOd.current = Date.now();
        posljiUkazObrazcu(ukaz);
        return ukaz === 'shrani' ? tRef.current('shranjujem') : tRef.current('zaprto');
      },
    });
    return () => {
      pogovor.current?.ustavi();
      pogovor.current = null;
    };
  }, [na_voljo, dodaj, premakni]);

  // Obrazec, ki ga je odprl asistent, javi odprtje/zaprtje (components/glas/useGlasovniObrazec).
  useEffect(() => {
    const ob = (e: Event) => {
      const odprtZdaj = Boolean((e as CustomEvent<{ odprt?: boolean }>).detail?.odprt);
      obrazecRef.current = odprtZdaj;
      setObrazecOdprt(odprtZdaj);
      if (pogovor.current) {
        pogovor.current.tisinaPoOdgovoru = odprtZdaj ? TISINA_OBRAZEC_MS : TISINA_OBICAJNO_MS;
        // Asistent ve, kateri obrazec je odprt, in ga z naslednjim ukazom dopolni.
        pogovor.current.kontekstObrazca = odprtZdaj ? (zadnjiObrazec.current ?? null) : null;
      }
      if (!odprtZdaj && shranjujeOd.current && Date.now() - shranjujeOd.current < SHRANI_OKNO_MS) {
        dodaj({ kdo: 'asistent', besedilo: tRef.current('shranjeno') });
      }
      if (!odprtZdaj) shranjujeOd.current = 0;
    };
    window.addEventListener(DOGODEK_STANJE, ob);
    return () => window.removeEventListener(DOGODEK_STANJE, ob);
  }, [dodaj]);

  useEffect(() => {
    konec.current?.scrollIntoView({ block: 'nearest' });
  }, [vrstice, slisano, odprt]);

  if (!na_voljo || BREZ.test(pot)) return null;

  const zaseden = s === 'povezujem' || s === 'razmisljam';
  const aktiven = s !== 'mirovanje';

  const tap = () => {
    const p = pogovor.current;
    if (!p) return;
    setOdprt(true);
    if (s === 'mirovanje') void p.zacni();
    else if (s === 'govorim') p.prekini();
    else if (s === 'poslusam') p.ustavi();
  };
  const zapri = () => {
    pogovor.current?.ustavi();
    setOdprt(false);
  };

  const opis = obrazecOdprt && s === 'poslusam' ? t('obrazec') : t(s);
  const zadnjiOdgovor = [...vrstice].reverse().find((v) => v.kdo !== 'jaz');

  // ── Obrazec odprt: pilula na vrhu (dno lista z gumbom Shrani ostane prosto) ──
  if (obrazecOdprt) {
    return (
      <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.5rem)] z-[70] flex justify-center px-4">
        <div className="pointer-events-auto flex max-w-[min(30rem,100%)] items-center gap-2 rounded-full bg-black/90 py-1.5 pl-1.5 pr-2 text-white shadow-lg backdrop-blur">
          <button type="button" onClick={tap} aria-label={t('odpri')} className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
            <Sij aktiven={aktiven} majhen />
            <Ikona s={s} velikost={16} />
          </button>
          <p className="min-w-0 truncate text-[13px] leading-tight" aria-live="polite">
            {s === 'poslusam' && slisano ? slisano : s === 'mirovanje' && zadnjiOdgovor ? zadnjiOdgovor.besedilo : opis}
          </p>
          {aktiven && (
            <button type="button" onClick={zapri} aria-label={t('koncaj')} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15">
              <X size={14} weight="bold" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {odprt && (
        <div
          role="dialog"
          aria-label={t('naslov')}
          className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] z-[70] flex max-h-[min(60vh,32rem)] flex-col overflow-hidden rounded-3xl border border-separator bg-white/95 shadow-2xl backdrop-blur-xl sm:inset-x-auto sm:right-6 sm:w-[380px]"
        >
          <div className="flex items-center justify-between px-4 pb-1 pt-3">
            <p className="text-[13px] font-semibold text-label">{t('naslov')}</p>
            <button type="button" onClick={zapri} aria-label={t('zapri')} className="-mr-1 flex h-8 w-8 items-center justify-center rounded-full text-label-secondary hover:bg-fill">
              <X size={16} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
            {vrstice.length === 0 && !slisano && <p className="py-2 text-sm text-label-secondary">{t('pozdrav')}</p>}
            <div className="flex flex-col gap-1.5">
              {vrstice.map((v, i) => (
                <p
                  key={i}
                  className={`max-w-[88%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm ${
                    v.kdo === 'jaz'
                      ? 'self-end bg-fill text-label'
                      : v.kdo === 'napaka'
                        ? 'self-start border border-red-200 text-red-600'
                        : 'self-start border border-separator text-label'
                  }`}
                >
                  {v.besedilo}
                </p>
              ))}
              {slisano && <p className="max-w-[88%] self-end rounded-2xl bg-fill px-3 py-2 text-sm italic text-label-secondary">{slisano}</p>}
            </div>

            {zadnji?.status === 'vprasanje' && zadnji.vprasanje?.moznosti?.length ? (
              <div className="mt-2 flex flex-col divide-y divide-separator overflow-hidden rounded-xl border border-separator">
                {zadnji.vprasanje.moznosti.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    disabled={zaseden}
                    onClick={() => void pogovor.current?.izberi(m)}
                    className="px-3 py-3 text-left text-sm text-label hover:bg-fill disabled:opacity-50 md:py-2"
                  >
                    {m.oznaka}
                  </button>
                ))}
              </div>
            ) : null}

            {zadnji?.status === 'predlog' && zadnji.predlog && (
              <div className="mt-2 rounded-2xl border border-separator p-3">
                {zadnji.predlog.podrobnosti.length > 0 && (
                  <dl className="divide-y divide-separator text-sm">
                    {zadnji.predlog.podrobnosti.map((d) => (
                      <div key={d.oznaka} className="flex justify-between gap-4 py-1.5">
                        <dt className="text-label-secondary">{d.oznaka}</dt>
                        <dd className="text-right text-label">{d.vrednost}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={zaseden}
                    onClick={() => void pogovor.current?.zavrniPredlog()}
                    className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-separator text-sm font-medium text-label disabled:opacity-50 md:h-8"
                  >
                    <X size={14} /> {t('preklici')}
                  </button>
                  <button
                    type="button"
                    disabled={zaseden}
                    onClick={() => void pogovor.current?.potrdiPredlog()}
                    className="btn-gradient-primary flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-medium disabled:opacity-50 md:h-8"
                  >
                    <Check size={14} weight="bold" /> {t('potrdi')}
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-label-tertiary">{t('predlogNamig')}</p>
              </div>
            )}
            <div ref={konec} />
          </div>

          <form
            className="hairline-t flex gap-2 px-3 py-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              const x = besedilo.trim();
              if (x && !zaseden) {
                void pogovor.current?.besedilo(x);
                setBesedilo('');
              }
            }}
          >
            <input
              value={besedilo}
              onChange={(e) => setBesedilo(e.target.value)}
              maxLength={500}
              placeholder={t('vpisi')}
              className="h-10 min-w-0 flex-1 rounded-xl bg-fill px-3 text-base text-label outline-none placeholder:text-label-tertiary md:h-8 md:text-sm"
            />
            <button
              type="submit"
              disabled={zaseden || !besedilo.trim()}
              aria-label={t('poslji')}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-label disabled:opacity-30 md:h-8 md:w-8"
            >
              <PaperPlaneRight size={18} />
            </button>
          </form>
        </div>
      )}

      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-4 z-[70] flex items-center gap-2 sm:bottom-6 sm:right-6">
        {aktiven && (
          <p className="hidden rounded-full bg-black/80 px-3 py-1.5 text-xs text-white shadow backdrop-blur sm:block" aria-live="polite">
            {opis}
          </p>
        )}
        <button
          type="button"
          onClick={tap}
          aria-label={aktiven ? opis : t('odpri')}
          className="relative flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl transition-transform active:scale-95"
        >
          <Sij aktiven={aktiven} />
          <Ikona s={s} velikost={24} />
        </button>
      </div>
    </>
  );
}

/** Siri-podoben sij: mirno ozadje v mirovanju, vrteč se barvni obroč med pogovorom. */
function Sij({ aktiven, majhen = false }: { aktiven: boolean; majhen?: boolean }) {
  return (
    <span aria-hidden className="absolute inset-0 overflow-hidden rounded-full">
      <span
        className={`absolute -inset-1/2 bg-[conic-gradient(from_0deg,#7c5cff,#3ba7ff,#2fd4a3,#ff6fb1,#7c5cff)] ${aktiven ? 'animate-spin' : ''}`}
        style={{ animationDuration: '2.4s' }}
      />
      <span className={`absolute rounded-full bg-black/25 ${majhen ? 'inset-[3px]' : 'inset-[5px]'} ${aktiven ? 'backdrop-blur-sm' : 'bg-transparent'}`} />
    </span>
  );
}

function Ikona({ s, velikost }: { s: StanjePogovora; velikost: number }) {
  const r = 'relative';
  if (s === 'povezujem' || s === 'razmisljam') {
    return <span className={`${r} h-[40%] w-[40%] animate-pulse rounded-full bg-white/90`} />;
  }
  if (s === 'govorim') return <SpeakerHigh className={r} size={velikost} weight="fill" />;
  if (s === 'poslusam') return <Stop className={r} size={velikost} weight="fill" />;
  return <Microphone className={r} size={velikost} weight="fill" />;
}
