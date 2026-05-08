'use client';

import { useRef, useState } from 'react';
import QRCode from 'react-qr-code';
import { toPng } from 'html-to-image';
import { DownloadSimple, Copy, Check, Info } from '@phosphor-icons/react';
import { motion } from 'motion/react';

interface QRCodeCardProps {
  slug: string;
  size?: number;
  showInfo?: boolean;
  compact?: boolean;
}

export function QRCodeCard({ slug, size = 280, showInfo = false, compact = false }: QRCodeCardProps) {
  const qrRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const url = `https://client.jedroplus.com/${slug}`;

  const handleDownload = async () => {
    if (!qrRef.current) return;
    try {
      const dataUrl = await toPng(qrRef.current, { cacheBust: true, pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `qr-${slug}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('QR download failed:', e);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Copy failed:', e);
    }
  };

  const btnBase = compact
    ? 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors'
    : 'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors';

  const iconSize = 'w-4 h-4';

  return (
    <div className="flex flex-col items-center gap-4">
      <div ref={qrRef} className="bg-white p-5 rounded-xl">
        <QRCode
          value={url}
          size={size}
          bgColor="#ffffff"
          fgColor="#000000"
          level="M"
        />
      </div>

      <p className="text-xs text-gray-400 select-all text-center break-all max-w-xs">
        {url}
      </p>

      <div className="flex items-center gap-3">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleDownload}
          className={`${btnBase} bg-gray-900 text-white hover:bg-gray-700`}
        >
          <DownloadSimple className={iconSize} weight="bold" />
          Prenesi PNG
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleCopy}
          className={`${btnBase} border border-gray-200 text-gray-700 hover:bg-gray-50`}
        >
          {copied ? (
            <Check className={`${iconSize} text-green-500`} weight="bold" />
          ) : (
            <Copy className={iconSize} weight="regular" />
          )}
          {copied ? 'Kopirano ✓' : 'Kopiraj povezavo'}
        </motion.button>
      </div>

      {showInfo && (
        <div className="mt-2 flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-4 max-w-sm text-sm text-blue-700">
          <Info className="w-5 h-5 flex-shrink-0 mt-0.5" weight="fill" />
          <p>
            To QR kodo lahko natisnete in jo postavite v vaš salon ali ordinacijo.
            Stranke jo skenirajo s telefonom in v manj kot minuti vnesejo svoje podatke.
          </p>
        </div>
      )}
    </div>
  );
}
