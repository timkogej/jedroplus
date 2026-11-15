'use client';

/**
 * /glas-dizajn — vsa stanja in prehodi Asistent+ z lažnimi podatki (brez mikrofona,
 * strežnika in prijave). Prizor se izbere s tipkami spodaj levo ali v naslovu:
 *   ?prizor=mirovanje|povezujem|poslusam|razmisljam|govorim|moznosti|predlog|obrazec|shrani|uspeh|napaka
 *   &cist=1  skrije tipke (za posnetke zaslona)   &toast=1  pokaže obvestilo spodaj desno
 *   &oblika=krog|logo|mehak|zele   &primerjava=1  vse oblike drug ob drugem (velike in v pravi velikosti)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CalendarBlank, CaretLeft, CaretRight, ListChecks, MagnifyingGlass, X } from '@phosphor-icons/react';
import { JedroLogo } from '@/components/brand/JedroLogo';
import { AsistentVmesnik } from '@/components/glas/ui/AsistentVmesnik';
import { useListObrazca } from '@/components/glas/ui/useOkvirObrazca';
import { AsistentOrb } from '@/components/glas/ui/AsistentOrb';
import { PlusOrb } from '@/components/glas/ui/PlusOrb';
import { OBLIKE, type OblikaOrba } from '@/components/glas/ui/plusOblika';
import { useNivoGlasu, type Glasnost } from '@/components/glas/ui/useNivoGlasu';
import type { Vrstica } from '@/components/glas/ui/tipi';
import type { OdgovorOdjemalec, StanjePogovora } from '@/lib/glas/odjemalec/pogovor';
import type { NacinKrogca, Okno } from '@/lib/glas/odjemalec/polozaj';

const PRIZORI = ['mirovanje', 'povezujem', 'poslusam', 'razmisljam', 'govorim', 'moznosti', 'predlog', 'obrazec', 'shrani', 'uspeh', 'napaka'] as const;
type Prizor = (typeof PRIZORI)[number];

const IZJAVA = 'Vpiši Ano Novak jutri ob desetih na pedikuro';
const ODGOVOR = 'Ana Novak, jutri ob 10.00, pedikura pri Maji. Shranim?';

type Stanje = {
  stanje: StanjePogovora;
  slisano: string;
  vrstice: Vrstica[];
  zadnji: OdgovorOdjemalec | null;
  obrazec: boolean;
  napis: string | null;
  uspeh: { kljuc: number; besedilo: string } | null;
};
const ZACETNO: Stanje = { stanje: 'mirovanje', slisano: '', vrstice: [], zadnji: null, obrazec: false, napis: null, uspeh: null };

function varniRobovi() {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
  document.body.appendChild(d);
  const cs = getComputedStyle(d);
  const r = { zgoraj: parseFloat(cs.paddingTop) || 0, spodaj: parseFloat(cs.paddingBottom) || 0 };
  d.remove();
  return r;
}

export function GlasDizajn() {
  const t = useTranslations('layout.asistent');
  const [st, setSt] = useState<Stanje>(ZACETNO);
  const [okno, setOkno] = useState<Okno | null>(null);
  const [cist, setCist] = useState(false);
  const [toast, setToast] = useState(false);
  const [oblika, setOblika] = useState<OblikaOrba>('mehak');
  const [primerjava, setPrimerjava] = useState(false);
  const [formEl, setFormEl] = useState<HTMLFormElement | null>(null);
  const [polja, setPolja] = useState({ stranka: 'Ana Novak', storitev: 'pedikura', zaposleni: 'maja', datum: '2026-11-14', ura: '10:00' });
  const casi = useRef<number[]>([]);
  const kljuc = useRef(0);
  const panel = useListObrazca(formEl, st.obrazec);

  const pocisti = () => {
    casi.current.forEach((c) => window.clearTimeout(c));
    casi.current = [];
  };
  const cez = (ms: number, f: () => void) => casi.current.push(window.setTimeout(f, ms));

  const pokazi = useCallback((p: Prizor) => {
    pocisti();
    setPolja({ stranka: 'Ana Novak', storitev: 'pedikura', zaposleni: 'maja', datum: '2026-11-14', ura: '10:00' });
    const jaz: Vrstica = { kdo: 'jaz', besedilo: IZJAVA };
    const asistent: Vrstica = { kdo: 'asistent', besedilo: ODGOVOR };
    switch (p) {
      case 'mirovanje':
        return setSt(ZACETNO);
      case 'povezujem':
        return setSt({ ...ZACETNO, stanje: 'povezujem' });
      case 'poslusam': {
        setSt({ ...ZACETNO, stanje: 'poslusam' });
        const besede = IZJAVA.split(' ');
        besede.forEach((_, i) => cez(500 + i * 320, () => setSt((s) => ({ ...s, slisano: besede.slice(0, i + 1).join(' ') }))));
        return;
      }
      case 'razmisljam':
        return setSt({ ...ZACETNO, stanje: 'razmisljam', vrstice: [jaz] });
      case 'govorim':
        setSt({ ...ZACETNO, stanje: 'razmisljam', vrstice: [jaz] });
        cez(700, () => setSt((s) => ({ ...s, stanje: 'govorim', vrstice: [jaz, asistent] })));
        cez(700 + 4200, () => setSt((s) => ({ ...s, stanje: 'poslusam' })));
        return;
      case 'moznosti':
        return setSt({
          ...ZACETNO,
          stanje: 'poslusam',
          vrstice: [{ kdo: 'jaz', besedilo: 'Prestavi Ano na petek' }, { kdo: 'asistent', besedilo: 'Imate dve Ani. Katero?' }],
          zadnji: {
            ok: true,
            status: 'vprasanje',
            vprasanje: {
              besedilo: 'Katero?',
              moznosti: [
                { id: 'a', oznaka: 'Ana Novak · 041 •••• 21' },
                { id: 'b', oznaka: 'Ana Kovač · 031 •••• 07' },
              ],
            },
          },
        });
      case 'predlog':
        return setSt({
          ...ZACETNO,
          stanje: 'poslusam',
          vrstice: [{ kdo: 'jaz', besedilo: 'Zapiši pri Ani, da ima rada mirno glasbo' }, { kdo: 'asistent', besedilo: 'Dodam zapisek pri Ani Novak?' }],
          zadnji: {
            ok: true,
            status: 'predlog',
            predlog: {
              id: 'p',
              zeton: 'x',
              orodje: 'zapisek',
              povzetek: 'Zapisek',
              podrobnosti: [
                { oznaka: 'Stranka', vrednost: 'Ana Novak' },
                { oznaka: 'Zapisek', vrednost: 'Ima rada mirno glasbo' },
              ],
              potece: '',
              sporocil: 0,
            },
          },
        });
      case 'obrazec':
      case 'shrani':
        setSt({ ...ZACETNO, stanje: 'govorim', vrstice: [jaz, asistent], obrazec: true });
        cez(2600, () => setSt((s) => ({ ...s, stanje: 'poslusam' })));
        // Glasovno dopolnjevanje: "pri Luki" → polje se vidno posodobi.
        cez(3800, () => setSt((s) => ({ ...s, slisano: 'Ne, pri Luki' })));
        cez(4600, () => setSt((s) => ({ ...s, slisano: '', stanje: 'razmisljam', vrstice: [...s.vrstice, { kdo: 'jaz', besedilo: 'Ne, pri Luki' }] })));
        cez(5400, () => {
          setPolja((x) => ({ ...x, zaposleni: 'luka' }));
          setSt((s) => ({ ...s, stanje: 'govorim', vrstice: [...s.vrstice, { kdo: 'asistent', besedilo: 'Pri Luki. Shranim?' }] }));
        });
        cez(7000, () => setSt((s) => ({ ...s, stanje: 'poslusam' })));
        if (p === 'shrani') {
          cez(8200, () => setSt((s) => ({ ...s, slisano: 'Ja' })));
          cez(8800, () => {
            setSt((s) => ({ ...s, slisano: '' }));
            document.querySelector<HTMLFormElement>('#glas-dizajn-obrazec')?.requestSubmit();
          });
        }
        return;
      case 'uspeh':
        return setSt({
          ...ZACETNO,
          stanje: 'govorim',
          vrstice: [{ kdo: 'jaz', besedilo: 'Ja' }, { kdo: 'uspeh', besedilo: 'Super, termin je zapisan.' }],
          uspeh: { kljuc: ++kljuc.current, besedilo: 'Super, termin je zapisan.' },
        });
      case 'napaka':
        return setSt({ ...ZACETNO, napis: 'Dostop do mikrofona ni dovoljen. Dovolite mikrofon za to stran v nastavitvah brskalnika.' });
    }
  }, []);

  // Začetni prizor iz naslova (?prizor=…&cist=1&toast=1).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const p = q.get('prizor') as Prizor | null;
    const c = window.setTimeout(() => {
      setCist(q.get('cist') === '1');
      setToast(q.get('toast') === '1');
      setPrimerjava(q.get('primerjava') === '1');
      const o = q.get('oblika') as OblikaOrba | null;
      if (o && OBLIKE.includes(o)) setOblika(o);
      if (p && PRIZORI.includes(p)) pokazi(p);
    }, 50);
    return () => window.clearTimeout(c);
  }, [pokazi]);

  useEffect(() => {
    const izmeri = () => setOkno({ w: window.innerWidth, h: window.innerHeight, ...varniRobovi() });
    izmeri();
    window.addEventListener('resize', izmeri);
    return () => window.removeEventListener('resize', izmeri);
  }, []);

  useEffect(() => () => pocisti(), []);

  // Lažna glasnost: govor z zlogi (sinus + šum).
  const glasnost = useCallback(() => {
    const c = performance.now() / 1000;
    const zlog = Math.abs(Math.sin(c * 7.3)) * (0.6 + 0.4 * Math.sin(c * 1.7)) + Math.random() * 0.15;
    return { vhod: 0.006 + zlog * 0.07, izhod: 0.01 + zlog * 0.17 };
  }, []);

  const zapriObrazec = (shranjeno: boolean) => {
    setSt((s) => {
      if (!shranjeno) return { ...s, obrazec: false };
      const besedilo = 'Super, termin je zapisan.';
      return {
        ...s,
        obrazec: false,
        stanje: 'govorim',
        vrstice: [...s.vrstice, { kdo: 'uspeh', besedilo }],
        uspeh: { kljuc: ++kljuc.current, besedilo },
      };
    });
    if (shranjeno) cez(2600, () => setSt((s) => ({ ...s, stanje: 'poslusam', uspeh: null })));
  };

  if (!okno) return null;
  const aktiven = st.stanje !== 'mirovanje';
  const nacin: NacinKrogca = st.obrazec ? 'obrazec' : aktiven ? 'sredina' : 'kot';

  return (
    <div className="min-h-dvh bg-[#fbfbfd] text-label">
      <LaznaAplikacija />

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-3 text-white shadow-lg">
          <ListChecks className="h-5 w-5" weight="fill" />
          <span className="text-sm font-medium">Termin je bil ustvarjen</span>
        </div>
      )}

      {st.obrazec && (
        <LazenObrazec
          refObrazca={setFormEl}
          polja={polja}
          setPolja={setPolja}
          onZapri={() => zapriObrazec(false)}
          onShrani={() => window.setTimeout(() => zapriObrazec(true), 450)}
        />
      )}

      {primerjava ? (
        <Primerjava stanje={st.stanje} uspeh={st.uspeh?.kljuc ?? null} okno={okno} glasnost={glasnost} onTap={() => pokazi(aktiven ? 'mirovanje' : 'povezujem')} />
      ) : (
        <AsistentVmesnik
          oblika={oblika}
          stanje={st.stanje}
          nacin={nacin}
          okno={okno}
          panel={panel}
          obrazecEl={st.obrazec ? formEl : null}
          slisano={st.slisano}
          vrstice={st.vrstice}
          zadnji={st.zadnji}
          napis={st.napis}
          uspeh={st.uspeh}
          glasnost={glasnost}
          t={t}
          onTap={() => pokazi(aktiven ? 'mirovanje' : 'povezujem')}
          onKoncaj={() => pokazi('mirovanje')}
          onBesedilo={() => pokazi('razmisljam')}
          onIzberi={() => pokazi('govorim')}
          onPotrdi={() => pokazi('uspeh')}
          onZavrni={() => pokazi('mirovanje')}
        />
      )}

      {!cist && (
        <div className="fixed left-2 top-2 z-[200] flex max-w-[calc(100vw-1rem)] flex-wrap gap-1 rounded-xl bg-black/80 p-1.5 text-[11px] text-white">
          {PRIZORI.map((p) => (
            <button key={p} type="button" onClick={() => pokazi(p)} className="rounded-md px-2 py-1 hover:bg-white/15">
              {p}
            </button>
          ))}
          <button type="button" onClick={() => setToast((x) => !x)} className="rounded-md px-2 py-1 hover:bg-white/15">
            toast
          </button>
          <span className="mx-1 w-px self-stretch bg-white/25" />
          {OBLIKE.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setOblika(o)}
              className={`rounded-md px-2 py-1 hover:bg-white/15 ${o === oblika && !primerjava ? 'bg-white/25' : ''}`}
            >
              {o}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPrimerjava((x) => !x)}
            className={`rounded-md px-2 py-1 hover:bg-white/15 ${primerjava ? 'bg-white/25' : ''}`}
          >
            primerjava
          </button>
        </div>
      )}
    </div>
  );
}

/** Vse oblike drug ob drugem: zgoraj velike, spodaj v pravi velikosti (kot v kotu aplikacije). */
function Primerjava({
  stanje,
  uspeh,
  okno,
  glasnost,
  onTap,
}: {
  stanje: StanjePogovora;
  uspeh: number | null;
  okno: Okno;
  glasnost: Glasnost;
  onTap: () => void;
}) {
  const siroko = okno.w >= 640;
  const stolpcev = siroko ? OBLIKE.length : 2;
  const celica = Math.min(220, (okno.w - 32) / stolpcev);
  const velika = Math.min(132, celica - 28);
  const zacetek = (okno.w - celica * stolpcev) / 2;
  return (
    <div className="fixed inset-0 z-[100] bg-white/80 backdrop-blur-md">
      {OBLIKE.map((o, i) => {
        const cx = zacetek + celica * (i % stolpcev) + celica / 2;
        const vrh = (siroko ? 110 : 80) + Math.floor(i / stolpcev) * (velika + 150);
        return <VzorecOrba key={o} oblika={o} stanje={stanje} uspeh={uspeh} glasnost={glasnost} onTap={onTap} cx={cx} vrh={vrh} velika={velika} />;
      })}
    </div>
  );
}

function VzorecOrba({
  oblika,
  stanje,
  uspeh,
  glasnost,
  onTap,
  cx,
  vrh,
  velika,
}: {
  oblika: OblikaOrba;
  stanje: StanjePogovora;
  uspeh: number | null;
  glasnost: Glasnost;
  onTap: () => void;
  cx: number;
  vrh: number;
  velika: number;
}) {
  const koren = useRef<HTMLDivElement | null>(null);
  useNivoGlasu(koren, stanje, glasnost);
  const orb = (v: number, y: number) => {
    const skupno = { stanje, x: cx - v / 2, y, velikost: v, uspeh, oznaka: oblika, onClick: onTap };
    return oblika === 'krog' ? <AsistentOrb {...skupno} /> : <PlusOrb razlicica={oblika} {...skupno} />;
  };
  return (
    <div ref={koren} className="ap-koren" data-stanje={stanje}>
      {orb(velika, vrh)}
      {orb(52, vrh + velika + 34)}
      <p className="fixed -translate-x-1/2 text-[13px] font-medium text-label-secondary" style={{ left: cx, top: vrh + velika + 96 }}>
        {oblika}
      </p>
    </div>
  );
}

/** Lažen koledar v ozadju (da se vidi zamegljenost in kontrast). */
function LaznaAplikacija() {
  const termini = [
    { ura: '08:00', ime: 'Maja Horvat', st: 'Manikura', b: '#7c78fa' },
    { ura: '09:30', ime: 'Tina Zupan', st: 'Barvanje', b: '#f59e0b' },
    { ura: '10:00', ime: 'Ana Kovač', st: 'Pedikura', b: '#35e3db' },
    { ura: '11:15', ime: 'Petra Kos', st: 'Striženje', b: '#ec4899' },
    { ura: '13:00', ime: 'Nina Mlakar', st: 'Masaža', b: '#59aeea' },
    { ura: '14:30', ime: 'Eva Golob', st: 'Manikura', b: '#10b981' },
    { ura: '16:00', ime: 'Sara Vidmar', st: 'Pedikura', b: '#7c78fa' },
  ];
  return (
    <>
      <header className="glass-bar hairline-b sticky top-0 z-40 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center gap-3 px-4 pt-[env(safe-area-inset-top)]">
        <JedroLogo height={22} />
        <div className="ml-auto flex items-center gap-2 text-label-secondary">
          <MagnifyingGlass size={20} />
          <CalendarBlank size={20} />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-40 pt-5">
        <div className="mb-4 flex items-center gap-2">
          <CaretLeft size={18} className="text-label-secondary" />
          <h1 className="text-[22px] font-semibold tracking-tight">Petek, 13. november</h1>
          <CaretRight size={18} className="text-label-secondary" />
        </div>
        <div className="flex flex-col gap-2">
          {termini.map((x) => (
            <div key={x.ura} className="flex items-center gap-3 rounded-2xl border border-separator bg-white p-3.5">
              <span className="w-12 text-sm font-medium text-label-secondary">{x.ura}</span>
              <span className="h-10 w-1 rounded-full" style={{ background: x.b }} />
              <div className="min-w-0">
                <p className="text-[15px] font-medium">{x.ime}</p>
                <p className="text-sm text-label-secondary">{x.st}</p>
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}

/** Lažen obrazec z enako zgradbo kot AppointmentModal (koren z-60, ozadje, list, form). */
function LazenObrazec({
  refObrazca,
  polja,
  setPolja,
  onZapri,
  onShrani,
}: {
  refObrazca: (el: HTMLFormElement | null) => void;
  polja: { stranka: string; storitev: string; zaposleni: string; datum: string; ura: string };
  setPolja: (f: (x: typeof polja) => typeof polja) => void;
  onZapri: () => void;
  onShrani: () => void;
}) {
  const vnos = 'h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-[15px] text-gray-900 outline-none';
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center overflow-hidden sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onZapri} />
      <div className="relative flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl bg-[#F2F2F7] shadow-2xl sm:max-h-[90vh] sm:rounded-2xl">
        <div className="glass-bar border-b border-gray-200/70 px-5 py-3.5">
          <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-gray-300 sm:hidden" />
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-semibold text-gray-900">Nov termin</h2>
            <button type="button" onClick={onZapri} className="-m-1.5 rounded-full p-3 text-gray-400">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <form
          id="glas-dizajn-obrazec"
          ref={refObrazca}
          onSubmit={(e) => {
            e.preventDefault();
            onShrani();
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex flex-col gap-4 overflow-y-auto px-5 py-5">
            <label className="flex flex-col gap-1.5 text-[13px] font-medium text-gray-500">
              Stranka
              <input className={vnos} value={polja.stranka} onChange={(e) => setPolja((x) => ({ ...x, stranka: e.target.value }))} />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium text-gray-500">
              Storitev
              <select className={vnos} value={polja.storitev} onChange={(e) => setPolja((x) => ({ ...x, storitev: e.target.value }))}>
                <option value="pedikura">Pedikura · 45 min</option>
                <option value="manikura">Manikura · 30 min</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5 text-[13px] font-medium text-gray-500">
                Datum
                <input type="date" className={vnos} value={polja.datum} onChange={(e) => setPolja((x) => ({ ...x, datum: e.target.value }))} />
              </label>
              <label className="flex flex-col gap-1.5 text-[13px] font-medium text-gray-500">
                Ura
                <input type="time" className={vnos} value={polja.ura} onChange={(e) => setPolja((x) => ({ ...x, ura: e.target.value }))} />
              </label>
            </div>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium text-gray-500">
              Zaposleni
              <select className={vnos} value={polja.zaposleni} onChange={(e) => setPolja((x) => ({ ...x, zaposleni: e.target.value }))}>
                <option value="maja">Maja</option>
                <option value="luka">Luka</option>
              </select>
            </label>
          </div>
          <div className="glass-bar border-t border-gray-200/70 px-5 py-3 pb-[max(env(safe-area-inset-bottom),12px)]">
            <button type="submit" className="btn-gradient-primary h-11 w-full rounded-xl text-[15px] font-semibold">
              Shrani
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
