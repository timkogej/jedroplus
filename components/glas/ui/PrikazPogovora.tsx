'use client';

/**
 * Prikaz pogovora pod orbom — minimalističen, ne klepet:
 *
 *   * zgoraj, manjše in zbledelo: prejšnja izjava (za kontekst);
 *   * glavno, veliko: sproten prepis med govorom (s kazalcem) ali odgovor
 *     asistenta, ki se izpisuje po besedah, približno sinhrono z glasom;
 *   * možnosti (npr. dve istoimenski stranki) in predlog kot kartice;
 *   * spodaj: tipkovnica (sekundarno) in konec pogovora.
 *
 * Za bralnike zaslona: zaključena izjava in odgovor gresta v aria-live (polite),
 * sproten prepis ne (preveč šuma).
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, CaretRight, Check, CheckCircle, EnvelopeSimple, Keyboard, Microphone, Phone, WarningCircle, X } from '@phosphor-icons/react';
import type { OdgovorOdjemalec, StanjePogovora } from '@/lib/glas/odjemalec/pogovor';
import type { Prikaz } from '@/lib/glas/tipi';
import type { Moznost, Vrstica } from './tipi';

/** Približna hitrost glasu (znakov na sekundo) za izpis po besedah. */
const ZNAKOV_NA_S = 15;

export interface PrikazPogovoraProps {
  stanje: StanjePogovora;
  slisano: string;
  vrstice: Vrstica[];
  zadnji: OdgovorOdjemalec | null;
  /** Zgornji rob prikaza (pod orbom), px. */
  vrh: number;
  t: (k: string) => string;
  onBesedilo: (x: string) => void;
  /** Uporabnik tipka v polju (ali ga zapre: false) — pogovor se medtem ne zapre. */
  onTipkam?: (aktivno: boolean) => void;
  onIzberi: (m: Moznost) => void;
  onPotrdi: () => void;
  onZavrni: () => void;
  onKoncaj: () => void;
  /** Orb že kaže kljukico (uspeh): v besedilu je ne ponavljamo. */
  kljukicaVOrbu?: boolean;
}

export function PrikazPogovora({ stanje, slisano, vrstice, zadnji, vrh, t, onBesedilo, onTipkam, onIzberi, onPotrdi, onZavrni, onKoncaj, kljukicaVOrbu = false }: PrikazPogovoraProps) {
  const zaseden = stanje === 'povezujem' || stanje === 'razmisljam';
  const zadnja = vrstice[vrstice.length - 1];
  const predzadnja = vrstice[vrstice.length - 2];

  // Glavna vrstica in tista nad njo (manjša, zbledela).
  let glavno: ReactNode;
  let zgoraj: Vrstica | undefined;
  if (slisano) {
    zgoraj = zadnja && zadnja.kdo !== 'jaz' ? zadnja : undefined;
    glavno = (
      <p className="text-label">
        {slisano}
        <span className="ap-kazalec" aria-hidden />
      </p>
    );
  } else if (zadnja) {
    zgoraj = predzadnja;
    glavno = <Glavna key={`${vrstice.length}-${zadnja.besedilo.length}`} v={zadnja} stanje={stanje} zadnja kljukica={!kljukicaVOrbu} />;
  } else {
    glavno = <p className="text-[17px] font-normal leading-relaxed text-label-secondary md:text-lg">{t('pozdrav')}</p>;
  }
  const koncnaVrstica = zadnja ? `${zadnja.besedilo}` : '';

  return (
    <div role="dialog" aria-label={t('naslov')} className="ap-prikaz pointer-events-none fixed inset-x-0 bottom-0 z-[108] flex flex-col items-center px-4" style={{ top: vrh }}>
      {/* Bralniki zaslona: zaključene izjave in odgovori. */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {koncnaVrstica}
      </p>

      <div className="pointer-events-auto flex w-full max-w-[560px] min-h-0 flex-1 flex-col items-center overflow-y-auto overscroll-contain pb-4 text-center">
        {/* Ko je na zaslonu kartica ali uspeh, »Poslušam«/»Govorim« ne pove nič novega
            (kartica ima svoj namig, orb kaže kljukico): status skrijemo. */}
        {!(imaKartico(zadnji) || zadnja?.kdo === 'uspeh') || zaseden ? <Status stanje={stanje} t={t} /> : <span className="h-5" aria-hidden />}

        {zgoraj && (
          <p
            key={`z-${vrstice.length}-${zgoraj.besedilo.length}`}
            className="ap-vstop mt-4 line-clamp-2 max-w-[92%] text-[15px] leading-snug text-[#4c4c55]"
          >
            {zgoraj.kdo === 'jaz' ? `»${zgoraj.besedilo}«` : zgoraj.besedilo}
          </p>
        )}

        <div className="mt-3 w-full text-[21px] font-semibold leading-[1.28] tracking-[-0.012em] [text-wrap:balance] md:text-[25px]">{glavno}</div>

        <Kartice zadnji={zadnji} zaseden={zaseden} t={t} onIzberi={onIzberi} onPotrdi={onPotrdi} onZavrni={onZavrni} />
      </div>

      <Kontrole zaseden={zaseden} t={t} onBesedilo={onBesedilo} onTipkam={onTipkam} onKoncaj={onKoncaj} />
    </div>
  );
}

/** Ali je pod odgovorom kartica (možnosti ali predlog). */
export function imaKartico(zadnji: OdgovorOdjemalec | null): boolean {
  return (
    Boolean(zadnji?.status === 'predlog' && zadnji.predlog) ||
    Boolean(zadnji?.status === 'vprasanje' && zadnji.vprasanje?.moznosti?.length) ||
    Boolean(zadnji?.status === 'odgovor' && zadnji.prikaz)
  );
}

function Status({ stanje, t }: { stanje: StanjePogovora; t: (k: string) => string }) {
  if (stanje === 'mirovanje') return null;
  return (
    <p className="flex h-5 items-center gap-1.5 text-[13px] font-medium tracking-wide text-[#4c4c55]">
      {(stanje === 'razmisljam' || stanje === 'povezujem') && (
        <span className="ap-tocke text-[color:var(--brand-violet)]" aria-hidden>
          <span />
          <span />
          <span />
        </span>
      )}
      {t(stanje)}
    </p>
  );
}

/** Glavna vrstica: uporabnikova izjava, odgovor (izpis po besedah), napaka ali uspeh. */
function Glavna({ v, stanje, zadnja, kljukica = true }: { v: Vrstica; stanje: StanjePogovora; zadnja: boolean; kljukica?: boolean }) {
  if (v.kdo === 'jaz') return <p className="ap-vstop text-label">{v.besedilo}</p>;
  if (v.kdo === 'napaka') {
    return (
      <p className="ap-vstop inline-flex items-start justify-center gap-2 text-[18px] font-medium text-[#c4372c] md:text-xl">
        <WarningCircle size={22} weight="fill" className="mt-0.5 shrink-0" aria-hidden />
        <span>{v.besedilo}</span>
      </p>
    );
  }
  if (v.kdo === 'uspeh') {
    return (
      <p className="ap-vstop inline-flex items-center justify-center gap-2 text-label">
        {kljukica && <CheckCircle size={26} weight="fill" className="shrink-0 text-[#1fb8b0]" aria-hidden />}
        <span>{v.besedilo}</span>
      </p>
    );
  }
  // Odgovor: besede se izpisujejo, ko asistent govori; ko utihne, je viden ves.
  const faza = !zadnja ? 'koncano' : stanje === 'govorim' ? 'teci' : stanje === 'razmisljam' ? 'caka' : 'koncano';
  let znaki = 0;
  const besede = v.besedilo.split(/(\s+)/);
  return (
    <p className="ap-odgovor text-label" data-teci={faza === 'teci' ? '' : undefined} data-koncano={faza === 'koncano' ? '' : undefined}>
      {besede.map((b, i) => {
        if (/^\s+$/.test(b)) return b;
        const zamik = znaki / ZNAKOV_NA_S;
        znaki += b.length + 1;
        return (
          <span key={i} className="ap-beseda" style={{ animationDelay: `${zamik.toFixed(2)}s` }}>
            {b}
          </span>
        );
      })}
    </p>
  );
}

function Kartice({
  zadnji,
  zaseden,
  t,
  onIzberi,
  onPotrdi,
  onZavrni,
}: {
  zadnji: OdgovorOdjemalec | null;
  zaseden: boolean;
  t: (k: string) => string;
  onIzberi: (m: Moznost) => void;
  onPotrdi: () => void;
  onZavrni: () => void;
}) {
  if (zadnji?.status === 'odgovor' && zadnji.prikaz) return <KarticaPrikaza p={zadnji.prikaz} />;
  if (zadnji?.status === 'vprasanje' && zadnji.vprasanje?.moznosti?.length) {
    return <Moznosti moznosti={zadnji.vprasanje.moznosti} zaseden={zaseden} t={t} onIzberi={onIzberi} />;
  }
  const akcije = (zadnji?.akcije ?? []).filter((a) => /^(tel|mailto):/.test(a.href));
  if (zadnji?.status !== 'predlog' && akcije.some((a) => a.oznaka)) {
    // Več strank (kandidati za luknjo): seznam klicev z imeni; klic začne uporabnik.
    return (
      <div className="ap-vstop mt-6 flex w-full max-w-[420px] flex-col gap-2" style={{ animationDelay: '120ms' }}>
        {akcije.map((a) => (
          <a
            key={a.href}
            href={a.href}
            className="ap-steklo flex h-12 items-center gap-3 rounded-2xl px-4 text-left text-[15px] font-semibold text-label transition-transform active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand-violet)] md:h-11 md:text-sm"
          >
            <Phone size={17} weight="fill" className="shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{a.oznaka}</span>
            <span className="shrink-0 text-[13px] font-medium text-label-secondary">{t('poklici')}</span>
          </a>
        ))}
      </div>
    );
  }
  if (zadnji?.status !== 'predlog' && akcije.length) {
    // Samo povezava: klic ali pošto začne uporabnik s pritiskom, asistent nikoli sam.
    return (
      <div className="ap-vstop mt-6 flex w-full max-w-[420px] gap-2" style={{ animationDelay: '120ms' }}>
        {akcije.map((a) => (
          <a
            key={a.vrsta}
            href={a.href}
            className="ap-steklo flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-label transition-transform active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand-violet)] md:h-11 md:text-sm"
          >
            {a.vrsta === 'klic' ? <Phone size={17} weight="fill" aria-hidden /> : <EnvelopeSimple size={17} weight="fill" aria-hidden />}
            {t(a.vrsta === 'klic' ? 'poklici' : 'pisi')}
          </a>
        ))}
      </div>
    );
  }
  if (zadnji?.status === 'predlog' && zadnji.predlog) {
    const { predlog } = zadnji;
    return (
      <div className="ap-kartica ap-vstop mt-6 w-full max-w-[420px] p-1.5 text-left" style={{ animationDelay: '120ms' }}>
        <div className="px-3.5 pb-1 pt-3">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-label-secondary">
            <span className="ap-znak" aria-hidden />
            {predlog.povzetek}
          </p>
          {predlog.podrobnosti.length > 0 && (
            <dl className="mt-2 divide-y divide-black/[0.06]">
              {predlog.podrobnosti.map((d) => (
                <div key={d.oznaka} className="flex items-baseline justify-between gap-4 py-2.5">
                  <dt className="shrink-0 text-[14px] text-label-secondary">{d.oznaka}</dt>
                  <dd className="min-w-0 text-right text-[15px] font-semibold leading-snug text-label">{d.vrednost}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        <div className="mt-1 flex gap-1.5">
          <button
            type="button"
            disabled={zaseden}
            onClick={onZavrni}
            className="ap-gumb-drugi flex h-12 flex-1 items-center justify-center gap-1.5 rounded-[18px] text-[15px] font-semibold text-label disabled:opacity-50 md:h-11"
          >
            <X size={15} weight="bold" aria-hidden /> {t('preklici')}
          </button>
          <button
            type="button"
            disabled={zaseden}
            onClick={onPotrdi}
            className="ap-gumb-glavni flex h-12 flex-1 items-center justify-center gap-1.5 rounded-[18px] text-[15px] font-semibold text-white disabled:opacity-50 md:h-11"
          >
            <Check size={15} weight="bold" aria-hidden /> {t(predlog.sporocil > 0 ? 'poslji' : 'potrdi')}
          </button>
        </div>
        <Namig>{t('predlogNamig')}</Namig>
      </div>
    );
  }
  return null;
}

/**
 * Odgovor kot kartica: številke v ploščicah, termini in seznami v vrsticah (čas levo).
 * Naslov je že v glavni vrstici zgoraj, zato ga tu ne ponavljamo.
 */
function KarticaPrikaza({ p }: { p: Prikaz }) {
  const ploscice = p.ploscice ?? [];
  const skupine = (p.skupine ?? []).filter((g) => g.vrstice.length);
  return (
    <div className="ap-kartica ap-vstop mt-5 w-full max-w-[460px] px-4 pb-4 pt-3.5 text-left" style={{ animationDelay: '120ms' }}>
      {p.podnaslov && <p className="tnum mb-2 text-[13px] font-medium text-label-secondary">{p.podnaslov}</p>}
      {ploscice.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {ploscice.map((x) => (
            <div key={x.oznaka} className="rounded-2xl bg-black/[0.035] px-3.5 py-3">
              <p className="truncate text-[12px] font-medium text-label-secondary">{x.oznaka}</p>
              <p className="tnum mt-0.5 truncate text-[22px] font-semibold leading-tight tracking-[-0.015em] text-label">{x.vrednost}</p>
              {x.sprememba && (
                <p
                  className={`tnum mt-1 flex items-center gap-1 truncate text-[12px] font-medium ${
                    x.smer === 'gor' ? 'text-emerald-600' : x.smer === 'dol' ? 'text-red-500' : 'text-label-secondary'
                  }`}
                >
                  {x.smer === 'gor' ? <ArrowUp size={11} weight="bold" aria-hidden /> : x.smer === 'dol' ? <ArrowDown size={11} weight="bold" aria-hidden /> : null}
                  <span className="truncate">{x.sprememba}</span>
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      {skupine.map((g, gi) => (
        <section key={gi} className={ploscice.length || gi > 0 ? 'mt-4' : ''}>
          {g.naslov && <h3 className="mb-1 text-[12px] font-semibold uppercase tracking-[0.04em] text-label-secondary">{g.naslov}</h3>}
          <ul className="divide-y divide-black/[0.06]">
            {g.vrstice.map((v, i) =>
              // Kratka vrednost brez časa (»24× · 1.440 €«): v isti vrstici desno, kot tabela.
              !v.cas && v.drugo && v.drugo.length <= 26 && !v.ton ? (
                <li key={i} className="flex items-baseline justify-between gap-3 py-2">
                  <span className="min-w-0 truncate text-[15px] font-semibold text-label">{v.glavno}</span>
                  <span className="tnum shrink-0 text-[14px] text-label-secondary">{v.drugo}</span>
                </li>
              ) : (
              <li key={i} className="flex items-baseline gap-3 py-2">
                {v.cas && <span className="tnum w-[88px] shrink-0 text-[13px] font-medium text-label-secondary">{v.cas}</span>}
                <span className="min-w-0 flex-1">
                  <span className={`flex items-start gap-1.5 text-[15px] font-semibold leading-snug ${v.ton === 'opozorilo' ? 'text-[#b4570f]' : 'text-label'}`}>
                    {v.ton === 'opozorilo' && <WarningCircle size={16} weight="fill" className="mt-[2px] shrink-0" aria-hidden />}
                    <span className="min-w-0 break-words">{v.glavno}</span>
                  </span>
                  {v.drugo && <span className="mt-0.5 block break-words text-[13px] leading-snug text-label-secondary">{v.drugo}</span>}
                </span>
              </li>
              )
            )}
          </ul>
          {g.se ? <p className="tnum pt-1 text-[13px] text-label-secondary">+{g.se}</p> : null}
        </section>
      ))}
      {p.opomba && <p className="mt-3 text-[12px] leading-snug text-label-secondary">{p.opomba}</p>}
    </div>
  );
}

/** Spodaj: tipkovnica (sekundarno) in konec pogovora. Nad tipkovnico na iPhonu. */
/** Možnosti (npr. dve istoimenski stranki): ena steklena kartica z vrsticami; tipke 1–9 izberejo. */
function Moznosti({
  moznosti,
  zaseden,
  t,
  onIzberi,
}: {
  moznosti: Moznost[];
  zaseden: boolean;
  t: (k: string) => string;
  onIzberi: (m: Moznost) => void;
}) {
  const izberi = useRef(onIzberi);
  useEffect(() => {
    izberi.current = onIzberi;
  });
  useEffect(() => {
    if (zaseden) return;
    const tipka = (e: KeyboardEvent) => {
      const cilj = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || cilj?.closest('input, textarea, select, [contenteditable]')) return;
      const i = Number(e.key) - 1;
      if (Number.isInteger(i) && i >= 0 && i < moznosti.length) {
        e.preventDefault();
        izberi.current(moznosti[i]);
      }
    };
    window.addEventListener('keydown', tipka);
    return () => window.removeEventListener('keydown', tipka);
  }, [moznosti, zaseden]);

  return (
    <div className="ap-kartica ap-vstop mt-6 w-full max-w-[420px] p-1.5" style={{ animationDelay: '120ms' }}>
      <ul className="flex flex-col">
        {moznosti.map((m, i) => {
          const [ime, ...ostalo] = m.oznaka.split(' · ');
          const podnapis = ostalo.join(' · ');
          return (
            <li key={m.id} className="ap-vstop" style={{ animationDelay: `${180 + i * 70}ms` }}>
              {i > 0 && <div className="mx-3.5 h-px bg-black/[0.06]" aria-hidden />}
              <button
                type="button"
                disabled={zaseden}
                onClick={() => onIzberi(m)}
                className="ap-vrstica group flex min-h-[60px] w-full items-center gap-3 rounded-[18px] px-3 py-2.5 text-left disabled:opacity-50 md:min-h-14"
              >
                <span className="ap-inicialke" aria-hidden>
                  {inicialke(ime)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-semibold leading-tight text-label md:text-[15px]">{ime}</span>
                  {podnapis && <span className="mt-0.5 block truncate text-[13px] tabular-nums text-label-secondary">{podnapis}</span>}
                </span>
                <kbd className="ap-tipka hidden md:inline-flex" aria-hidden>
                  {i + 1}
                </kbd>
                <CaretRight size={16} weight="bold" className="shrink-0 text-label-tertiary transition-transform group-hover:translate-x-0.5" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
      <Namig>{t('moznostiNamig')}</Namig>
    </div>
  );
}

function inicialke(ime: string): string {
  const deli = ime.replace(/\([^)]*\)/g, '').trim().split(/\s+/).filter(Boolean);
  return ((deli[0]?.[0] ?? '') + (deli.length > 1 ? deli[deli.length - 1][0] : '')).toUpperCase();
}

/** Namig pod kartico (glas): z ikono mikrofona. */
function Namig({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center justify-center gap-1.5 px-3 pb-1.5 pt-2.5 text-[12.5px] text-label-secondary">
      <Microphone size={13} weight="fill" className="text-[color:var(--brand-violet)]" aria-hidden />
      {children}
    </p>
  );
}

function Kontrole({
  zaseden,
  t,
  onBesedilo,
  onTipkam,
  onKoncaj,
}: {
  zaseden: boolean;
  t: (k: string) => string;
  onBesedilo: (x: string) => void;
  onTipkam?: (aktivno: boolean) => void;
  onKoncaj: () => void;
}) {
  const [pisem, setPisem] = useState(false);
  const [besedilo, setBesedilo] = useState('');
  const vnos = useRef<HTMLInputElement | null>(null);
  const tipkovnica = useTipkovnica(pisem);

  useEffect(() => {
    if (pisem) vnos.current?.focus();
    onTipkam?.(pisem);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- samo ob odprtju/zaprtju polja
  }, [pisem]);

  const poslji = () => {
    const x = besedilo.trim();
    if (!x || zaseden) return;
    onBesedilo(x);
    setBesedilo('');
  };

  return (
    <div
      className="pointer-events-auto flex w-full max-w-[560px] shrink-0 items-center justify-center gap-3 pt-2"
      style={{ paddingBottom: `calc(max(env(safe-area-inset-bottom), 12px) + 16px + ${tipkovnica}px)` }}
    >
      {pisem ? (
        <form
          className="ap-steklo ap-vstop flex h-12 min-w-0 flex-1 items-center gap-1 rounded-full pl-4 pr-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            poslji();
          }}
        >
          <input
            ref={vnos}
            value={besedilo}
            onChange={(e) => {
              setBesedilo(e.target.value);
              onTipkam?.(true);
            }}
            onFocus={() => onTipkam?.(true)}
            onKeyDown={(e) => {
              // Esc v polju zapre samo vnos, ne pogovora.
              if (e.key === 'Escape') {
                e.stopPropagation();
                setPisem(false);
              }
            }}
            maxLength={500}
            enterKeyHint="send"
            placeholder={t('vpisi')}
            aria-label={t('vpisi')}
            className="h-full min-w-0 flex-1 bg-transparent text-base text-label outline-none placeholder:text-label-tertiary md:text-[15px]"
          />
          <button
            type="submit"
            disabled={zaseden || !besedilo.trim()}
            aria-label={t('poslji')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-opacity disabled:opacity-30"
            style={{ background: 'linear-gradient(135deg, var(--brand-violet), var(--brand-cyan))' }}
          >
            <ArrowUp size={17} weight="bold" />
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setPisem(true)}
          aria-label={t('tipkovnica')}
          className="ap-steklo flex h-12 items-center gap-2 rounded-full px-4 text-[14px] font-medium text-label-secondary transition-transform active:scale-95"
        >
          <Keyboard size={19} aria-hidden />
          <span>{t('tipkovnica')}</span>
        </button>
      )}
      <button
        type="button"
        onClick={onKoncaj}
        aria-label={t('koncaj')}
        className="ap-steklo flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-label transition-transform active:scale-95"
      >
        <X size={18} weight="bold" aria-hidden />
      </button>
    </div>
  );
}

/** Višina zaslonske tipkovnice (iPhone Safari ne premakne fixed elementov sam). */
function useTipkovnica(aktivna: boolean): number {
  const [visina, setVisina] = useState(0);
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!aktivna || !vv) return;
    const izmeri = () => setVisina(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    izmeri();
    vv.addEventListener('resize', izmeri);
    vv.addEventListener('scroll', izmeri);
    return () => {
      vv.removeEventListener('resize', izmeri);
      vv.removeEventListener('scroll', izmeri);
      setVisina(0);
    };
  }, [aktivna]);
  return visina;
}
