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
import { ArrowUp, CaretRight, Check, CheckCircle, EnvelopeSimple, Keyboard, Phone, WarningCircle, X } from '@phosphor-icons/react';
import type { OdgovorOdjemalec, StanjePogovora } from '@/lib/glas/odjemalec/pogovor';
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
  onIzberi: (m: Moznost) => void;
  onPotrdi: () => void;
  onZavrni: () => void;
  onKoncaj: () => void;
}

export function PrikazPogovora({ stanje, slisano, vrstice, zadnji, vrh, t, onBesedilo, onIzberi, onPotrdi, onZavrni, onKoncaj }: PrikazPogovoraProps) {
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
    glavno = <Glavna key={`${vrstice.length}-${zadnja.besedilo.length}`} v={zadnja} stanje={stanje} zadnja />;
  } else {
    glavno = <p className="text-[17px] font-normal leading-relaxed text-label-secondary md:text-lg">{t('pozdrav')}</p>;
  }
  const koncnaVrstica = zadnja ? `${zadnja.besedilo}` : '';

  return (
    <div role="dialog" aria-label={t('naslov')} className="pointer-events-none fixed inset-x-0 bottom-0 z-[108] flex flex-col items-center px-4" style={{ top: vrh }}>
      {/* Bralniki zaslona: zaključene izjave in odgovori. */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {koncnaVrstica}
      </p>

      <div className="pointer-events-auto flex w-full max-w-[560px] min-h-0 flex-1 flex-col items-center overflow-y-auto overscroll-contain pb-4 text-center">
        <Status stanje={stanje} t={t} />

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

      <Kontrole zaseden={zaseden} t={t} onBesedilo={onBesedilo} onKoncaj={onKoncaj} />
    </div>
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
function Glavna({ v, stanje, zadnja }: { v: Vrstica; stanje: StanjePogovora; zadnja: boolean }) {
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
        <CheckCircle size={26} weight="fill" className="shrink-0 text-[#1fb8b0]" aria-hidden />
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
  if (zadnji?.status === 'vprasanje' && zadnji.vprasanje?.moznosti?.length) {
    return (
      <div className="ap-vstop mt-6 flex w-full max-w-[420px] flex-col gap-2" style={{ animationDelay: '120ms' }}>
        {zadnji.vprasanje.moznosti.map((m, i) => (
          <button
            key={m.id}
            type="button"
            disabled={zaseden}
            onClick={() => onIzberi(m)}
            className="ap-steklo ap-vstop group flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-[15px] font-medium text-label transition-transform duration-200 hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand-violet)] active:scale-[0.98] disabled:opacity-50 md:min-h-11"
            style={{ animationDelay: `${160 + i * 70}ms` }}
          >
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white"
              style={{ background: 'var(--gradient-brand)' }}
              aria-hidden
            >
              {i + 1}
            </span>
            <span className="min-w-0 flex-1">{m.oznaka}</span>
            <CaretRight size={16} className="shrink-0 text-label-tertiary transition-transform group-hover:translate-x-0.5" aria-hidden />
          </button>
        ))}
      </div>
    );
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
    return (
      <div className="ap-steklo ap-vstop mt-6 w-full max-w-[420px] rounded-3xl p-4 text-left" style={{ animationDelay: '120ms' }}>
        {zadnji.predlog.podrobnosti.length > 0 && (
          <dl className="divide-y divide-black/[0.06] text-[15px]">
            {zadnji.predlog.podrobnosti.map((d) => (
              <div key={d.oznaka} className="flex justify-between gap-4 py-2">
                <dt className="text-label-secondary">{d.oznaka}</dt>
                <dd className="text-right font-medium text-label">{d.vrednost}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={zaseden}
            onClick={onZavrni}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-black/[0.05] text-[15px] font-medium text-label transition-colors hover:bg-black/[0.08] disabled:opacity-50 md:h-10 md:text-sm"
          >
            <X size={15} aria-hidden /> {t('preklici')}
          </button>
          <button
            type="button"
            disabled={zaseden}
            onClick={onPotrdi}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl text-[15px] font-semibold text-white shadow-[0_8px_20px_-8px_rgb(89_100_234/0.7)] transition-transform active:scale-[0.98] disabled:opacity-50 md:h-10 md:text-sm"
            style={{ background: 'linear-gradient(135deg, var(--brand-violet), var(--brand-blue) 60%, var(--brand-cyan))' }}
          >
            <Check size={15} weight="bold" aria-hidden /> {t(zadnji.predlog.sporocil > 0 ? 'poslji' : 'potrdi')}
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-label-tertiary">{t('predlogNamig')}</p>
      </div>
    );
  }
  return null;
}

/** Spodaj: tipkovnica (sekundarno) in konec pogovora. Nad tipkovnico na iPhonu. */
function Kontrole({
  zaseden,
  t,
  onBesedilo,
  onKoncaj,
}: {
  zaseden: boolean;
  t: (k: string) => string;
  onBesedilo: (x: string) => void;
  onKoncaj: () => void;
}) {
  const [pisem, setPisem] = useState(false);
  const [besedilo, setBesedilo] = useState('');
  const vnos = useRef<HTMLInputElement | null>(null);
  const tipkovnica = useTipkovnica(pisem);

  useEffect(() => {
    if (pisem) vnos.current?.focus();
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
            onChange={(e) => setBesedilo(e.target.value)}
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
