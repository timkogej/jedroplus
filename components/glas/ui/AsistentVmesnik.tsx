'use client';

/**
 * Asistent+ — celoten videz (brez logike pogovora). AsistentPlus mu poda stanje in
 * povratne klice; testna stran /glas-dizajn pa lažna stanja.
 *
 * Plasti (z-index):
 *   aplikacija ≤ 56 · obrazci 60–100 · tančica 104 (ob obrazcu 59, pod listom)
 *   · sij roba 106 · prikaz pogovora 108 · orb 110.
 *
 * Načini (nacin, iz AsistentPlus):
 *   kot     — orb ob desnem robu, nad pasom obvestil (toast spodaj desno);
 *   sredina — orb odplava na sredino in se poveča, ozadje se zamegli, rob zažari,
 *             pod orbom napisi, kartice in tipkovnica;
 *   obrazec — samo obrazec v ospredju (tančica pod listom), orb v zgornjem
 *             levem kotu lista, kratek napis desno od njega.
 */

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { CheckCircle, MicrophoneSlash, WarningCircle } from '@phosphor-icons/react';
import type { OdgovorOdjemalec, StanjePogovora } from '@/lib/glas/odjemalec/pogovor';
import { polozajKrogca, type NacinKrogca, type Okno, type Polozaj, type Pravokotnik } from '@/lib/glas/odjemalec/polozaj';
import { AsistentOrb } from './AsistentOrb';
import { PlusOrb } from './PlusOrb';
import type { OblikaOrba } from './plusOblika';
import { ObrobaZaslona } from './ObrobaZaslona';
import { imaKartico, PrikazPogovora } from './PrikazPogovora';
import { Tancica } from './Tancica';
import { useNivoGlasu, type Glasnost } from './useNivoGlasu';
import { useOkvirObrazca } from './useOkvirObrazca';
import type { Moznost, Vrstica } from './tipi';
import './asistent.css';

/** Pas obvestil (toast: bottom-6 right-6, ~48 px visok): orb v mirovanju je nad njim. */
const NAD_OBVESTILI = 92;

/** Med drsenjem je v kotu viden le ta delež orba (ostalo je za desnim robom). */
const VIDNO_OB_UMIKU = 0.42;
/** Koliko časa po zadnjem drsenju se orb vrne iz umika. */
const UMIK_MS = 900;

/**
 * Položaj orba za vsak način (sredina in obrazec iz polozajKrogca; večji orb na sredini).
 * kompakten: na sredini je kartica (možnosti, predlog), orb se zmanjša in umakne gor.
 * umaknjen: v kotu med drsenjem orb zdrsne napol čez desni rob.
 */
export function polozajOrba(
  nacin: NacinKrogca,
  okno: Okno,
  panel: Pravokotnik | null,
  kompakten = false,
  umaknjen = false,
  plus = false,
): Polozaj {
  const siroko = okno.w >= 640;
  if (nacin === 'kot') {
    // Plus stoji na steklenem krogu (PlusOrb), zato je v kotu malo večji kot krog.
    const v = plus ? (siroko ? 58 : 54) : siroko ? 52 : 48;
    const rob = plus ? (siroko ? 22 : 12) : siroko ? 24 : 14;
    const x = umaknjen ? okno.w - Math.round(v * VIDNO_OB_UMIKU) : okno.w - v - rob;
    return { x, y: okno.h - v - okno.spodaj - NAD_OBVESTILI, velikost: v };
  }
  const p = polozajKrogca(nacin, okno, panel);
  if (nacin !== 'sredina') return p;
  const v = kompakten ? (siroko ? 88 : 76) : siroko ? 136 : 112;
  const cy = p.y + p.velikost / 2;
  return { x: Math.round((okno.w - v) / 2), y: Math.round(Math.max(okno.zgoraj + 20, cy - v / 2)), velikost: v };
}

export interface AsistentVmesnikProps {
  stanje: StanjePogovora;
  nacin: NacinKrogca;
  okno: Okno;
  panel: Pravokotnik | null;
  /** Element obrazca, ki ga je odprl asistent (za okvir in sij polj). */
  obrazecEl: HTMLElement | null;
  slisano: string;
  vrstice: Vrstica[];
  zadnji: OdgovorOdjemalec | null;
  /** Napaka po koncu pogovora (ob orbu v mirovanju). */
  napis: string | null;
  /** Uspeh (shranjen obrazec): ključ za animacijo in besedilo. */
  uspeh: { kljuc: number; besedilo: string } | null;
  glasnost?: Glasnost;
  t: (k: string) => string;
  onTap: () => void;
  onPripravi?: () => void;
  onKoncaj: () => void;
  onBesedilo: (x: string) => void;
  onIzberi: (m: Moznost) => void;
  onPotrdi: () => void;
  onZavrni: () => void;
  /** Obrazec je bil oddan (gumb Shrani ali glasovni "shrani"). */
  onPoslano?: (form: HTMLFormElement) => void;
  /** Oblika orba: krog ali plus (različice v plusOblika.ts). */
  oblika?: OblikaOrba;
}

/** Oblika v aplikaciji (testna stran jo lahko preklaplja). */
export const OBLIKA_PRIVZETA: OblikaOrba = 'obris';

export function AsistentVmesnik(p: AsistentVmesnikProps) {
  const { stanje, nacin, okno, panel, t, oblika = OBLIKA_PRIVZETA } = p;
  const koren = useRef<HTMLDivElement | null>(null);
  useNivoGlasu(koren, stanje, p.glasnost);
  useOkvirObrazca(p.obrazecEl, nacin === 'obrazec', p.onPoslano);

  const aktiven = stanje !== 'mirovanje';
  // Umik med drsenjem: samo v kotu in ko ob orbu ni napisa (napaka, uspeh).
  const plus = oblika !== 'krog';
  const umaknjen = useUmikObDrsenju(plus && nacin === 'kot' && !aktiven && !p.napis && !p.uspeh);
  const poz = polozajOrba(nacin, okno, panel, nacin === 'sredina' && imaKartico(p.zadnji), umaknjen, plus);
  const oznaka = aktiven ? t(stanje) : t('odpri');
  const zadnjiOdgovor = [...p.vrstice].reverse().find((v) => v.kdo !== 'jaz');

  return (
    <div ref={koren} className="ap-koren" data-stanje={stanje}>
      <Tancica vidna={nacin !== 'kot'} obrazec={nacin === 'obrazec'} onTap={p.onKoncaj} />
      <ObrobaZaslona vidna={aktiven} />

      {nacin === 'sredina' && (
        <PrikazPogovora
          stanje={stanje}
          slisano={p.slisano}
          vrstice={p.vrstice}
          zadnji={p.zadnji}
          vrh={poz.y + poz.velikost + 18}
          t={t}
          onBesedilo={p.onBesedilo}
          onIzberi={p.onIzberi}
          onPotrdi={p.onPotrdi}
          onZavrni={p.onZavrni}
          onKoncaj={p.onKoncaj}
          kljukicaVOrbu={p.uspeh != null}
        />
      )}

      {nacin === 'obrazec' && (
        <NapisObrazca
          poz={poz}
          okno={okno}
          besedilo={
            stanje === 'poslusam' && p.slisano
              ? p.slisano
              : !aktiven
                ? t('mirovanje')
                : zadnjiOdgovor && stanje !== 'poslusam'
                  ? zadnjiOdgovor.besedilo
                  : t('obrazec')
          }
          zivo={stanje === 'poslusam' && Boolean(p.slisano)}
          aktiven={aktiven}
          t={t}
          onKoncaj={p.onKoncaj}
        />
      )}

      {nacin === 'kot' && (p.napis || p.uspeh) && (
        <ObOrbu poz={poz} okno={okno} vrsta={p.napis ? 'napaka' : 'uspeh'}>
          {p.napis ?? p.uspeh?.besedilo}
        </ObOrbu>
      )}

      {oblika === 'krog' ? (
        <AsistentOrb
          stanje={stanje}
          x={poz.x}
          y={poz.y}
          velikost={poz.velikost}
          uspeh={p.uspeh?.kljuc ?? null}
          oznaka={oznaka}
          onClick={p.onTap}
          onPripravi={p.onPripravi}
        />
      ) : (
        <PlusOrb
          razlicica={oblika}
          stanje={stanje}
          x={poz.x}
          y={poz.y}
          velikost={poz.velikost}
          uspeh={p.uspeh?.kljuc ?? null}
          oznaka={oznaka}
          onClick={p.onTap}
          onPripravi={p.onPripravi}
        />
      )}
    </div>
  );
}

/**
 * Ali naj se orb v kotu umakne čez rob: true med drsenjem (katerikoli element na
 * strani) in še UMIK_MS po njem. Brez zank: samo poslušalec drsenja (passive).
 */
function useUmikObDrsenju(vklopljen: boolean): boolean {
  const [umaknjen, setUmaknjen] = useState(false);
  useEffect(() => {
    if (!vklopljen) return;
    let casovnik = 0;
    const ob = () => {
      setUmaknjen(true);
      window.clearTimeout(casovnik);
      casovnik = window.setTimeout(() => setUmaknjen(false), UMIK_MS);
    };
    document.addEventListener('scroll', ob, { capture: true, passive: true });
    return () => {
      document.removeEventListener('scroll', ob, { capture: true });
      window.clearTimeout(casovnik);
      setUmaknjen(false);
    };
  }, [vklopljen]);
  return vklopljen && umaknjen;
}

/** Ob obrazcu: kratek napis desno od orba (nad listom, ne čez polja ne čez X). */
function NapisObrazca({
  poz,
  okno,
  besedilo,
  zivo,
  aktiven,
  t,
  onKoncaj,
}: {
  poz: Polozaj;
  okno: Okno;
  besedilo: string;
  zivo: boolean;
  aktiven: boolean;
  t: (k: string) => string;
  onKoncaj: () => void;
}) {
  const levo = poz.x + poz.velikost + 10;
  const slog: CSSProperties = {
    left: levo,
    top: poz.y + poz.velikost / 2 - 18,
    maxWidth: Math.max(150, Math.min(420, okno.w - levo - 64)),
  };
  return (
    <div className="pointer-events-none fixed z-[110] flex items-center gap-1.5" style={slog}>
      <p
        key={zivo ? 'zivo' : besedilo}
        className="ap-steklo ap-vstop pointer-events-auto flex h-9 min-w-0 items-center rounded-full px-3.5 text-[13.5px] font-medium leading-none text-label"
        aria-live="polite"
      >
        <span className={`truncate ${zivo ? 'text-label' : ''}`}>{besedilo}</span>
        {zivo && <span className="ap-kazalec" aria-hidden />}
      </p>
      {aktiven && (
        <button
          type="button"
          onClick={onKoncaj}
          aria-label={t('koncaj')}
          className="ap-steklo pointer-events-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-label-secondary"
        >
          {/* Ne X: X na obrazcu zapre obrazec, ta gumb ustavi asistenta. */}
          <MicrophoneSlash size={15} weight="bold" aria-hidden />
        </button>
      )}
    </div>
  );
}

/** V mirovanju: napaka ali uspeh levo nad orbom (nekaj sekund). */
function ObOrbu({ poz, okno, vrsta, children }: { poz: Polozaj; okno: Okno; vrsta: 'napaka' | 'uspeh'; children: React.ReactNode }) {
  return (
    <p
      role="status"
      className="ap-steklo ap-vstop fixed z-[110] flex max-w-[min(20rem,calc(100vw-2rem))] items-start gap-2 rounded-2xl px-3.5 py-2.5 text-[14px] leading-snug text-label"
      style={{ right: okno.w - poz.x - poz.velikost, bottom: okno.h - poz.y + 12 }}
    >
      {vrsta === 'napaka' ? (
        <WarningCircle size={18} weight="fill" className="mt-px shrink-0 text-[#c4372c]" aria-hidden />
      ) : (
        <CheckCircle size={18} weight="fill" className="mt-px shrink-0 text-[#1fb8b0]" aria-hidden />
      )}
      <span>{children}</span>
    </p>
  );
}
