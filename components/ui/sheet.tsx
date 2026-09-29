'use client';

/**
 * Applovi gradniki za modalna okna.
 *
 * Na telefonu se okno obnaša kot iOS list: prileti od spodaj, ima ročaj na
 * vrhu in je zgoraj zaobljeno. Na širokem zaslonu je macOS plošča: sredinsko
 * poravnana, zaobljena po vseh kotih, z lasnim robom in mehko senco.
 *
 * Vsebina je urejena v skupine (`SheetGroup`) z vrsticami (`SheetRow`) —
 * oznaka levo, vrednost desno, med vrsticami zamaknjena lasna črta. To je
 * vzorec iz iOS Nastavitev in macOS Nastavitev in je razlog, da se tak zaslon
 * bere hitro: vse vrednosti so poravnane v en stolpec.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { X } from '@phosphor-icons/react';

const EASE_SHEET = [0.32, 0.72, 0, 1] as const;

/**
 * Ali smo na širokem zaslonu — določa, ali okno prileti od spodaj ali zraste
 * na sredini.
 *
 * Vrednost je prebrana že v inicializatorju useState, ne šele v useEffect.
 * Če se spremeni po prvem izrisu, framer-motion sredi leta zamenja varianto,
 * animacija se prekine in okno obvisi na pol prosojnosti.
 */
function useIsWide() {
  const [isWide, setIsWide] = useState(() =>
    typeof window === 'undefined'
      ? true
      : window.matchMedia('(min-width: 640px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)');
    const update = () => setIsWide(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return isWide;
}

interface SheetProps {
  onClose: () => void;
  children: ReactNode;
  /** Širina plošče na velikem zaslonu. Applovi listi so ozki. */
  maxWidth?: string;
}

export function Sheet({ onClose, children, maxWidth = 'sm:max-w-[430px]' }: SheetProps) {
  const isWide = useIsWide();

  // Tipka Escape zapre okno — pričakovano povsod, ne samo pri Applu.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Ozadje se ne sme premikati, dokler je okno odprto.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/25 backdrop-blur-[3px] sm:items-center sm:p-4"
    >
      <motion.div
        initial={isWide ? { opacity: 0, scale: 0.97, y: 8 } : { opacity: 1, scale: 1, y: '100%' }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={isWide ? { opacity: 0, scale: 0.97, y: 8 } : { opacity: 1, scale: 1, y: '100%' }}
        transition={{ duration: isWide ? 0.24 : 0.36, ease: EASE_SHEET }}
        onClick={(e) => e.stopPropagation()}
        className={`relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[88vh] sm:rounded-2xl sm:border sm:border-gray-100 ${maxWidth}`}
      >
        {/* Ročaj — samo na telefonu, kot pri iOS listih */}
        <div className="flex justify-center pt-2 sm:hidden" aria-hidden="true">
          <div className="h-1 w-9 rounded-full bg-gray-300" />
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

interface SheetHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Barvna pika ob naslovu — pri terminu barva storitve, kot v Applovem Koledarju. */
  accent?: string;
  badge?: ReactNode;
  onClose: () => void;
  closeLabel: string;
}

export function SheetHeader({
  title,
  subtitle,
  accent,
  badge,
  onClose,
  closeLabel,
}: SheetHeaderProps) {
  return (
    <div className="hairline-b flex-shrink-0 px-5 pb-3.5 pt-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            {accent && (
              <span
                className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                style={{ background: accent }}
                aria-hidden="true"
              />
            )}
            <h2 className="min-w-0 truncate text-xl font-semibold text-gray-900">
              {title}
            </h2>
          </div>
          {(subtitle || badge) && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {subtitle && <span className="text-sm text-gray-500">{subtitle}</span>}
              {badge}
            </div>
          )}
        </div>

        {/* Brez kroga okoli križca — samo znak, ki potemni ob prehodu */}
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="-mr-1 -mt-0.5 flex-shrink-0 p-1 text-gray-400 transition-colors hover:text-gray-900"
        >
          <X className="h-5 w-5" weight="regular" />
        </button>
      </div>
    </div>
  );
}

export function SheetBody({ children }: { children: ReactNode }) {
  return (
    <div className="custom-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
      {children}
    </div>
  );
}

interface SheetGroupProps {
  /** Drobna oznaka nad skupino, kot naslov razdelka v iOS Nastavitvah. */
  label?: string;
  children: ReactNode;
}

export function SheetGroup({ label, children }: SheetGroupProps) {
  return (
    <section>
      {label && (
        <h3 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-[0.04em] text-gray-400">
          {label}
        </h3>
      )}
      {/* Lasne črte med vrsticami so narisane kot reže v mreži, da so povsod
          enako debele in se na stikih ne podvojijo. */}
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-gray-100">
        <div className="flex flex-col gap-px">{children}</div>
      </div>
    </section>
  );
}

interface SheetRowProps {
  label: ReactNode;
  value?: ReactNode;
  /** Vsebina čez celo širino namesto para oznaka/vrednost (opombe, seznami). */
  children?: ReactNode;
  href?: string;
  onClick?: () => void;
}

export function SheetRow({ label, value, children, href, onClick }: SheetRowProps) {
  const inner = children ?? (
    <>
      <span className="flex-shrink-0 text-sm text-gray-500">{label}</span>
      <span className="min-w-0 truncate text-right text-sm font-medium text-gray-900">
        {value}
      </span>
    </>
  );

  const base =
    'flex min-h-[44px] items-center justify-between gap-4 bg-white px-4 py-2.5';

  if (href) {
    return (
      <a href={href} className={`${base} transition-colors hover:bg-gray-50 active:bg-gray-100`}>
        {inner}
      </a>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${base} w-full text-left transition-colors hover:bg-gray-50 active:bg-gray-100`}>
        {inner}
      </button>
    );
  }

  return <div className={base}>{inner}</div>;
}

export function SheetFooter({ children }: { children: ReactNode }) {
  return (
    <div className="hairline-t flex flex-shrink-0 items-center gap-2 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {children}
    </div>
  );
}
