'use client';

/**
 * Natisljiv plakat z QR kodo za rezervacijsko stran.
 *
 * Postavitev je pri vseh videzih enaka — razlikujejo se samo barve in pisava.
 * Tako koda ostane na istem mestu in enako velika, kar je pri tisku
 * pomembnejše od okraskov: telefon jo mora prebrati s pol metra.
 *
 * Mere: A6 (105 × 148 mm), risano pri 4 px na milimeter → 420 × 592 px.
 * Pri izvozu se poveča, zato je tisk oster.
 *
 * Izbrani videz se NE shranjuje. Podjetje izbere, vidi predogled in prenese;
 * če bi si ga bilo treba zapomniti, je to en stolpec v "Podatki podjetij".
 */

import { useRef, useState } from 'react';
import QRCode from 'react-qr-code';
import { toPng } from 'html-to-image';
import { DownloadSimple, FilePdf } from '@phosphor-icons/react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';

const MM = 4; // px na milimeter
const SIRINA = 105 * MM; // 420
const VISINA = 148 * MM; // 592
const QR_VELIKOST = 55 * MM; // 220

export type PlakatVidez = 'cisti' | 'barve' | 'eleganten' | 'temen';

export interface PlakatSlog {
  ozadje: string;
  naziv: string;
  poziv: string;
  povezava: string;
  crta: string;
  /** Okvir okoli bele podlage kode — pri temnih videzih je bela ploščica. */
  qrPodlaga: string;
  nazivPisava?: string;
  pozivPisava?: string;
}

/**
 * Barve podjetja pridejo iz rezervacijskih nastavitev, zato je plakat enak
 * rezervacijski strani, na katero koda pelje.
 */
export function plakatSlogi(
  primary: string,
  bgFrom: string,
  bgTo: string
): Record<PlakatVidez, PlakatSlog> {
  const serif = 'Georgia, "Times New Roman", serif';
  return {
    cisti: {
      ozadje: '#FFFFFF',
      naziv: '#111827',
      poziv: '#111827',
      povezava: '#9CA3AF',
      crta: '#E5E7EB',
      qrPodlaga: '#FFFFFF',
    },
    barve: {
      ozadje: `linear-gradient(170deg, ${bgFrom} 0%, ${bgTo} 100%)`,
      naziv: '#0F172A',
      poziv: primary,
      povezava: 'rgba(15,23,42,0.55)',
      crta: 'rgba(15,23,42,0.14)',
      qrPodlaga: '#FFFFFF',
    },
    eleganten: {
      ozadje: '#FAF7F2',
      naziv: '#3D2B1F',
      poziv: '#9C8572',
      povezava: '#B2A294',
      crta: '#C4956A',
      qrPodlaga: '#FFFFFF',
      nazivPisava: serif,
      pozivPisava: serif,
    },
    temen: {
      ozadje: '#0B0B0F',
      naziv: '#F8FAFC',
      poziv: '#F8FAFC',
      povezava: 'rgba(248,250,252,0.5)',
      crta: 'rgba(248,250,252,0.18)',
      qrPodlaga: '#FFFFFF',
    },
  };
}

interface QrPlakatProps {
  url: string;
  naziv: string;
  /** Poziv pod kodo, npr. »Rezerviraj termin«. */
  poziv: string;
  slog: PlakatSlog;
  /** Pomanjšava za predogled; 1 = prava velikost A6 pri 4 px/mm. */
  merilo?: number;
}

/** Sam plakat — brez gumbov, da ga je mogoče uporabiti tudi kot predogled. */
export function QrPlakatList({ url, naziv, poziv, slog, merilo = 1 }: QrPlakatProps) {
  return (
    <div
      style={{
        width: SIRINA,
        height: VISINA,
        transform: merilo === 1 ? undefined : `scale(${merilo})`,
        transformOrigin: 'top left',
      }}
    >
      <div
        style={{
          width: SIRINA,
          height: VISINA,
          background: slog.ozadje,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 10 * MM,
          boxSizing: 'border-box',
          fontFamily: 'var(--font-ui), Inter, Arial, sans-serif',
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: slog.naziv,
            textAlign: 'center',
            lineHeight: 1.2,
            fontFamily: slog.nazivPisava ?? 'inherit',
            maxWidth: '100%',
            overflowWrap: 'anywhere',
          }}
        >
          {naziv}
        </div>

        <div
          style={{
            width: 48,
            height: 2,
            background: slog.crta,
            margin: '14px 0 22px',
            borderRadius: 2,
          }}
        />

        <div
          style={{
            background: slog.qrPodlaga,
            padding: 4 * MM,
            borderRadius: 12,
            lineHeight: 0,
          }}
        >
          <QRCode value={url} size={QR_VELIKOST} bgColor="#ffffff" fgColor="#000000" level="M" />
        </div>

        <div
          style={{
            marginTop: 24,
            fontSize: 19,
            fontWeight: 600,
            color: slog.poziv,
            textAlign: 'center',
            fontFamily: slog.pozivPisava ?? 'inherit',
          }}
        >
          {poziv}
        </div>

        <div
          style={{
            marginTop: 10,
            fontSize: 10,
            color: slog.povezava,
            textAlign: 'center',
            overflowWrap: 'anywhere',
            maxWidth: '100%',
          }}
        >
          {url.replace(/^https?:\/\//, '')}
        </div>
      </div>
    </div>
  );
}

interface QrPlakatPrenosProps extends QrPlakatProps {
  /** Osnova imena datoteke, brez končnice. */
  imeDatoteke: string;
}

/** Plakat v pravi velikosti, skrit iz pogleda, plus gumba za prenos. */
export function QrPlakatPrenos({
  url,
  naziv,
  poziv,
  slog,
  imeDatoteke,
}: QrPlakatPrenosProps) {
  const t = useTranslations('common.qr');
  const ref = useRef<HTMLDivElement>(null);
  const [dela, setDela] = useState<'png' | 'pdf' | null>(null);

  /** Plakat je v DOM v pravi velikosti; zajamemo ga pri trikratni ločljivosti. */
  async function zajem(): Promise<string | null> {
    if (!ref.current) return null;
    return toPng(ref.current, {
      cacheBust: true,
      pixelRatio: 3,
      width: SIRINA,
      height: VISINA,
    });
  }

  async function prenesiPng() {
    setDela('png');
    try {
      const dataUrl = await zajem();
      if (!dataUrl) return;
      const a = document.createElement('a');
      a.download = `${imeDatoteke}.png`;
      a.href = dataUrl;
      a.click();
    } catch (e) {
      console.error('QR plakat PNG failed:', e);
    } finally {
      setDela(null);
    }
  }

  async function prenesiPdf() {
    setDela('pdf');
    try {
      const dataUrl = await zajem();
      if (!dataUrl) return;
      // jsPDF je težek; naloži se šele ob kliku, ne v začetnem svežnju.
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'mm', format: 'a6', orientation: 'portrait' });
      doc.addImage(dataUrl, 'PNG', 0, 0, 105, 148);
      doc.save(`${imeDatoteke}.pdf`);
    } catch (e) {
      console.error('QR plakat PDF failed:', e);
    } finally {
      setDela(null);
    }
  }

  return (
    <>
      {/* Plakat mora biti v pravi velikosti, da je zajem oster. Skrijemo ga z
          odmikom in ne z `display: none`, ker html-to-image potrebuje izmere. */}
      <div
        aria-hidden
        style={{ position: 'fixed', left: -10000, top: 0, pointerEvents: 'none' }}
      >
        <div ref={ref}>
          <QrPlakatList url={url} naziv={naziv} poziv={poziv} slog={slog} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          disabled={dela !== null}
          onClick={prenesiPdf}
          className="flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
        >
          <FilePdf className="h-4 w-4" weight="bold" />
          {dela === 'pdf' ? t('preparing') : t('downloadPdf')}
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          disabled={dela !== null}
          onClick={prenesiPng}
          className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          <DownloadSimple className="h-4 w-4" weight="bold" />
          {dela === 'png' ? t('preparing') : t('downloadPng')}
        </motion.button>
      </div>
    </>
  );
}

export const PLAKAT_SIRINA = SIRINA;
export const PLAKAT_VISINA = VISINA;
