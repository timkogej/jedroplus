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
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Microphone, PaperPlaneRight, SpeakerHigh, X, Check } from '@phosphor-icons/react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { Pogovor, type OdgovorOdjemalec, type StanjePogovora } from '@/lib/glas/odjemalec/pogovor';
import { shraniObrazec } from '@/lib/glas/odjemalec/predizpolnitev';
import {
  DOGODEK_IZID,
  DOGODEK_STANJE,
  posljiPojdi,
  posljiUkazObrazcu,
  ukazObrazcu,
  type IzidObrazca,
  type StanjeObrazca,
} from '@/lib/glas/odjemalec/obrazecGlas';
import { polozajKrogca, type NacinKrogca, type Okno, type Polozaj, type Pravokotnik } from '@/lib/glas/odjemalec/polozaj';

/** Strani, kjer asistenta ni (prijava, registracija, testna stran ima svojega). */
const BREZ = /^\/(login|signup|forgot-password|logout|auth|onboarding|glas-test)(\/|$)/;
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

// Izgovorjeni izidi: glas asistenta je slovenski (Soniox Nina, jezik seje "sl").
const GOVOR = {
  shranjeno: 'Shranjeno.',
  poslano: 'Poslano.',
  zaprto: 'Prav, zaprto. Nič ni shranjeno.',
  neObvescam: 'Prav, stranke ne obveščam.',
  niShranjeno: 'Še ni shranjeno.',
  preveri: 'Obrazec še ni shranjen. Poglejte ga, prosim.',
};

type Vrstica = { kdo: 'jaz' | 'asistent' | 'napaka'; besedilo: string };
type OdprtObrazec = { el: HTMLElement | null; vprasanje?: string };

/** List (panel) obrazca: najvišji prednik, ki ne pokriva celega zaslona (ozadje). */
function najdiPanel(el: HTMLElement): HTMLElement {
  let p = el;
  while (p.parentElement && p.parentElement !== document.body) {
    const r = p.parentElement.getBoundingClientRect();
    if (r.width >= window.innerWidth - 1 && r.height >= window.innerHeight - 1) break;
    p = p.parentElement;
  }
  return p;
}

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
  const [besedilo, setBesedilo] = useState('');
  const [obrazec, setObrazec] = useState<OdprtObrazec | null>(null);
  const [panel, setPanel] = useState<Pravokotnik | null>(null);
  const [okno, setOkno] = useState<Okno | null>(null);
  const [napis, setNapis] = useState<string | null>(null);
  const pogovor = useRef<Pogovor | null>(null);
  const potRef = useRef(pot);
  const obrazecRef = useRef<OdprtObrazec | null>(null);
  const shranjujeOd = useRef(0);
  const zadnjiObrazec = useRef<OdgovorOdjemalec['obrazec'] | null>(null);
  const najave = useRef<string[]>([]);
  const najavaCasovnik = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Zadnja izgovorjena najava (že v vrsticah; obvestilo je ne doda znova). */
  const zadnjaNajava = useRef('');
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
        const govor = o.vprasanje ? GOVOR.neObvescam : GOVOR.zaprto;
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
      if (shranjujeOd.current && Date.now() - shranjujeOd.current < SHRANI_OKNO_MS) {
        najavi(bil?.vprasanje ? GOVOR.poslano : GOVOR.shranjeno);
      }
      shranjujeOd.current = 0;
    };
    const izid = (e: Event) => {
      const d = (e as CustomEvent<IzidObrazca>).detail;
      if (!shranjujeOd.current || !d) return;
      shranjujeOd.current = 0;
      najavi(d.napaka ? `${GOVOR.niShranjeno} ${d.napaka}` : GOVOR.preveri, 'napaka');
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

  // Položaj lista obrazca (med animacijo odpiranja in ob spremembi velikosti).
  useEffect(() => {
    const el = obrazec?.el;
    if (!el || !el.isConnected) {
      setPanel(obrazec ? { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight } : null);
      return;
    }
    const list = najdiPanel(el);
    const izmeri = () => {
      if (!list.isConnected) return;
      const r = list.getBoundingClientRect();
      setPanel((prej) =>
        prej && Math.abs(prej.left - r.left) < 1 && Math.abs(prej.top - r.top) < 1 ? prej : { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
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
  }, [obrazec]);

  // Napaka po koncu pogovora (npr. mikrofon ni dovoljen) ostane vidna nekaj sekund.
  useEffect(() => {
    if (!napis) return;
    const c = window.setTimeout(() => setNapis(null), NAPIS_MS);
    return () => window.clearTimeout(c);
  }, [napis]);

  useEffect(() => {
    konec.current?.scrollIntoView({ block: 'nearest' });
  }, [vrstice, slisano]);

  const aktiven = s !== 'mirovanje';

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

  const zaseden = s === 'povezujem' || s === 'razmisljam';
  const nacin: NacinKrogca = obrazec ? 'obrazec' : aktiven ? 'sredina' : 'kot';
  const poz: Polozaj = polozajKrogca(nacin, okno, panel);

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
  const zapri = () => pogovor.current?.ustavi();

  const opis = obrazec && s === 'poslusam' ? (obrazec.vprasanje ? t('predlogNamig') : t('obrazec')) : t(s);
  const zadnjiOdgovor = [...vrstice].reverse().find((v) => v.kdo !== 'jaz');
  const prikaz = vrstice.slice(-4);

  return (
    <>
      {/* Način pogovora: nežna tančica, stran ostane vidna. */}
      <div
        aria-hidden
        className={`fixed inset-0 z-[105] bg-white/60 backdrop-blur-[3px] transition-opacity duration-300 ${
          nacin === 'sredina' ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <button
        type="button"
        onClick={tap}
        onPointerEnter={() => pogovor.current?.pripravi()}
        onPointerDown={() => pogovor.current?.pripravi()}
        aria-label={aktiven ? opis : t('odpri')}
        className="fixed left-0 top-0 z-[110] flex items-center justify-center rounded-full text-white shadow-xl active:scale-95"
        style={{
          width: poz.velikost,
          height: poz.velikost,
          transform: `translate3d(${poz.x}px, ${poz.y}px, 0)`,
          transition: 'transform 480ms cubic-bezier(0.2, 0.8, 0.2, 1), width 300ms ease, height 300ms ease',
        }}
      >
        <Sij aktiven={aktiven} razmislja={zaseden} majhen={poz.velikost < 48} />
        <Ikona s={s} velikost={Math.round(poz.velikost * 0.4)} />
      </button>

      {/* Sredina: napisi, možnosti, predlog in vnos pod krogcem. */}
      {nacin === 'sredina' && (
        <div
          role="dialog"
          aria-label={t('naslov')}
          className="fixed z-[110] flex flex-col items-center"
          style={{
            left: 16,
            right: 16,
            top: poz.y + poz.velikost + 20,
            maxHeight: `calc(100dvh - ${poz.y + poz.velikost + 36}px - env(safe-area-inset-bottom))`,
          }}
        >
          <div className="flex min-h-0 w-full max-w-[420px] flex-col">
            <p className="text-center text-[13px] font-medium text-label-secondary" aria-live="polite">
              {opis}
            </p>
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
              {prikaz.length === 0 && !slisano && <p className="text-center text-sm text-label-secondary">{t('pozdrav')}</p>}
              <div className="flex flex-col gap-1.5">
                {prikaz.map((v, i) => (
                  <p
                    key={`${vrstice.length}-${i}`}
                    className={`max-w-[88%] whitespace-pre-line rounded-2xl px-3 py-2 text-[15px] leading-snug ${
                      v.kdo === 'jaz'
                        ? 'self-end bg-fill text-label'
                        : v.kdo === 'napaka'
                          ? 'self-start border border-red-200 bg-white text-red-600'
                          : 'self-start border border-separator bg-white text-label'
                    }`}
                  >
                    {v.besedilo}
                  </p>
                ))}
                {slisano && <p className="max-w-[88%] self-end rounded-2xl bg-fill px-3 py-2 text-[15px] italic text-label-secondary">{slisano}</p>}
              </div>
              <Kartice
                zadnji={zadnji}
                zaseden={zaseden}
                t={t}
                izberi={(m) => void pogovor.current?.izberi(m)}
                potrdi={() => void pogovor.current?.potrdiPredlog()}
                zavrni={() => void pogovor.current?.zavrniPredlog()}
              />
              <div ref={konec} />
            </div>
            <form
              className="mt-3 flex gap-2"
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
                className="h-10 min-w-0 flex-1 rounded-xl border border-separator bg-white px-3 text-base text-label outline-none placeholder:text-label-tertiary md:h-9 md:text-sm"
              />
              <button
                type="submit"
                disabled={zaseden || !besedilo.trim()}
                aria-label={t('poslji')}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-label disabled:opacity-30 md:h-9 md:w-9"
              >
                <PaperPlaneRight size={18} />
              </button>
              <button
                type="button"
                onClick={zapri}
                aria-label={t('koncaj')}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-separator bg-white text-label md:h-9 md:w-9"
              >
                <X size={16} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Obrazec: kratek napis desno od krogca (nad listom, ne čez polja). */}
      {nacin === 'obrazec' && (
        <div
          className="pointer-events-none fixed z-[110] flex items-center gap-1.5"
          style={{
            left: poz.x + poz.velikost + 8,
            top: poz.y + poz.velikost / 2 - 16,
            maxWidth: Math.max(160, Math.min(380, okno.w - poz.x - poz.velikost - 20)),
          }}
        >
          <p className="pointer-events-auto truncate rounded-full bg-black/85 px-3 py-1.5 text-[13px] leading-tight text-white shadow backdrop-blur" aria-live="polite">
            {s === 'poslusam' && slisano ? slisano : !aktiven ? t('mirovanje') : zadnjiOdgovor && s !== 'poslusam' ? zadnjiOdgovor.besedilo : opis}
          </p>
          {aktiven && (
            <button
              type="button"
              onClick={zapri}
              aria-label={t('koncaj')}
              className="pointer-events-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/70 text-white"
            >
              <X size={13} weight="bold" />
            </button>
          )}
        </div>
      )}

      {/* Kot: napaka po koncu pogovora. */}
      {nacin === 'kot' && napis && (
        <p
          role="status"
          className="fixed z-[110] max-w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-red-200 bg-white px-3 py-2 text-sm text-red-600 shadow-lg"
          style={{ right: okno.w - poz.x - poz.velikost, bottom: okno.h - poz.y + 10 }}
        >
          {napis}
        </p>
      )}
    </>
  );
}

function Kartice({
  zadnji,
  zaseden,
  t,
  izberi,
  potrdi,
  zavrni,
}: {
  zadnji: OdgovorOdjemalec | null;
  zaseden: boolean;
  t: ReturnType<typeof useTranslations>;
  izberi: (m: { id: string; oznaka: string }) => void;
  potrdi: () => void;
  zavrni: () => void;
}) {
  if (zadnji?.status === 'vprasanje' && zadnji.vprasanje?.moznosti?.length) {
    return (
      <div className="mt-2 flex flex-col divide-y divide-separator overflow-hidden rounded-xl border border-separator bg-white">
        {zadnji.vprasanje.moznosti.map((m) => (
          <button
            key={m.id}
            type="button"
            disabled={zaseden}
            onClick={() => izberi(m)}
            className="px-3 py-3 text-left text-sm text-label hover:bg-fill disabled:opacity-50 md:py-2"
          >
            {m.oznaka}
          </button>
        ))}
      </div>
    );
  }
  if (zadnji?.status === 'predlog' && zadnji.predlog) {
    return (
      <div className="mt-2 rounded-2xl border border-separator bg-white p-3">
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
            onClick={zavrni}
            className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-separator text-sm font-medium text-label disabled:opacity-50 md:h-8"
          >
            <X size={14} /> {t('preklici')}
          </button>
          <button
            type="button"
            disabled={zaseden}
            onClick={potrdi}
            className="btn-gradient-primary flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-medium disabled:opacity-50 md:h-8"
          >
            <Check size={14} weight="bold" /> {t('potrdi')}
          </button>
        </div>
        <p className="mt-1.5 text-xs text-label-tertiary">{t('predlogNamig')}</p>
      </div>
    );
  }
  return null;
}

/** Siri-podoben sij: mirno ozadje v mirovanju, vrteč se barvni obroč med pogovorom. */
function Sij({ aktiven, razmislja, majhen = false }: { aktiven: boolean; razmislja: boolean; majhen?: boolean }) {
  return (
    <span aria-hidden className={`absolute inset-0 overflow-hidden rounded-full ${razmislja ? 'animate-pulse' : ''}`}>
      <span
        className={`absolute -inset-1/2 bg-[conic-gradient(from_0deg,#7c5cff,#3ba7ff,#2fd4a3,#ff6fb1,#7c5cff)] ${aktiven ? 'animate-spin' : ''}`}
        style={{ animationDuration: razmislja ? '1.2s' : '2.4s' }}
      />
      <span className={`absolute rounded-full bg-black/25 ${majhen ? 'inset-[3px]' : 'inset-[5px]'} ${aktiven ? 'backdrop-blur-sm' : 'bg-transparent'}`} />
    </span>
  );
}

function Ikona({ s, velikost }: { s: StanjePogovora; velikost: number }) {
  const r = 'relative';
  if (s === 'povezujem' || s === 'razmisljam') {
    return <span className={`${r} h-[34%] w-[34%] animate-pulse rounded-full bg-white/90`} />;
  }
  if (s === 'govorim') return <SpeakerHigh className={r} size={velikost} weight="fill" />;
  if (s === 'poslusam') return <Valovi velikost={velikost} />;
  return <Microphone className={r} size={velikost} weight="fill" />;
}

/** Poslušam: tri mirne črtice (namesto ikone Stop — tap še vedno konča pogovor). */
function Valovi({ velikost }: { velikost: number }) {
  return (
    <span className="relative flex items-center gap-[3px]" style={{ height: velikost }} aria-hidden>
      {[0, 150, 300].map((zamik) => (
        <span key={zamik} className="w-[3px] animate-pulse rounded-full bg-white" style={{ height: '55%', animationDelay: `${zamik}ms` }} />
      ))}
    </span>
  );
}
