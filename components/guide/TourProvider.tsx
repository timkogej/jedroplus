'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { X } from '@phosphor-icons/react';
import { useAuth } from '@/app/auth-context';
import { isTourDone, markTourDone, type TourId } from '@/lib/guide/progress';
import { TOURS, type Placement, type TourStep } from './tours';

interface TourContextValue {
  /** Start a tour now (ignores whether it was seen before). */
  startTour: (id: TourId) => void;
  /** Start a tour only if this user hasn't finished it yet. */
  startTourOnce: (id: TourId) => void;
  activeTour: TourId | null;
}

const TourContext = createContext<TourContextValue | undefined>(undefined);

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within TourProvider');
  return ctx;
}

/** Soft variant for components that may render outside the provider. */
export function useOptionalTour(): TourContextValue | null {
  return useContext(TourContext) ?? null;
}

// ─── Geometry ───────────────────────────────────────────────────────────────

const PAD = 6; // space between element and highlight ring
const GAP = 14; // space between highlight and card
const CARD_W = 320;
const MARGIN = 12; // keep the card this far from the viewport edge

function visibleRect(selector: string | undefined): DOMRect | null {
  if (!selector) return null;
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return null;
  const style = window.getComputedStyle(el);
  if (style.visibility === 'hidden' || style.display === 'none') return null;
  return rect;
}

function cardPosition(rect: DOMRect | null, placement: Placement, cardH: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(CARD_W, vw - MARGIN * 2);
  const clampX = (x: number) => Math.max(MARGIN, Math.min(x, vw - width - MARGIN));
  const clampY = (y: number) => Math.max(MARGIN, Math.min(y, vh - cardH - MARGIN));

  if (!rect || placement === 'center') {
    const cx = rect ? rect.left + rect.width / 2 : vw / 2;
    const cy = rect ? rect.top + Math.min(rect.height, vh) / 2 : vh / 2;
    return { left: clampX(cx - width / 2), top: clampY(cy - cardH / 2), width };
  }

  const fits = {
    right: rect.right + PAD + GAP + width <= vw - MARGIN,
    left: rect.left - PAD - GAP - width >= MARGIN,
    bottom: rect.bottom + PAD + GAP + cardH <= vh - MARGIN,
    top: rect.top - PAD - GAP - cardH >= MARGIN,
  };
  const order: Placement[] = [placement, 'bottom', 'right', 'top', 'left'];
  const side = order.find((p) => p !== 'center' && fits[p as keyof typeof fits]) ?? 'bottom';

  switch (side) {
    case 'right':
      return { left: rect.right + PAD + GAP, top: clampY(rect.top + rect.height / 2 - cardH / 2), width };
    case 'left':
      return { left: rect.left - PAD - GAP - width, top: clampY(rect.top + rect.height / 2 - cardH / 2), width };
    case 'top':
      return { left: clampX(rect.left + rect.width / 2 - width / 2), top: rect.top - PAD - GAP - cardH, width };
    default:
      return { left: clampX(rect.left + rect.width / 2 - width / 2), top: clampY(rect.bottom + PAD + GAP), width };
  }
}

// ─── Provider ───────────────────────────────────────────────────────────────

export function TourProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeTour, setActiveTour] = useState<TourId | null>(null);

  const startTour = useCallback((id: TourId) => setActiveTour(id), []);
  const startTourOnce = useCallback(
    (id: TourId) => {
      if (!user?.id || isTourDone(user.id, id)) return;
      setActiveTour((current) => current ?? id);
    },
    [user?.id]
  );

  const finish = useCallback(() => {
    if (activeTour) markTourDone(user?.id, activeTour);
    setActiveTour(null);
  }, [activeTour, user?.id]);

  const value = useMemo(() => ({ startTour, startTourOnce, activeTour }), [startTour, startTourOnce, activeTour]);

  return (
    <TourContext.Provider value={value}>
      {children}
      {activeTour && <TourOverlay tour={activeTour} steps={TOURS[activeTour]} onFinish={finish} />}
    </TourContext.Provider>
  );
}

// ─── Overlay ────────────────────────────────────────────────────────────────

function TourOverlay({ tour, steps, onFinish }: { tour: TourId; steps: TourStep[]; onFinish: () => void }) {
  const t = useTranslations('layout.guide');
  // Only steps whose element is on screen right now (or intro cards).
  const [available] = useState<TourStep[]>(() =>
    steps.filter((s) => !s.target || visibleRect(s.target) !== null)
  );
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [cardH, setCardH] = useState(180);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const step = available[index];
  const isLast = index === available.length - 1;

  // Bring the target into view when the step changes.
  useEffect(() => {
    if (!step?.target) return;
    const el = document.querySelector(step.target) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [step]);

  // Track the target's position (layout shifts, scrolling, resizing).
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      setRect((prev) => {
        const next = step?.target ? visibleRect(step.target) : null;
        if (!prev || !next) return next;
        return prev.top === next.top && prev.left === next.left && prev.width === next.width && prev.height === next.height
          ? prev
          : next;
      });
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [step]);

  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
  }, [index, rect]);

  useEffect(() => {
    nextRef.current?.focus();
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFinish();
      if (e.key === 'ArrowRight') setIndex((i) => (i < available.length - 1 ? i + 1 : i));
      if (e.key === 'ArrowLeft') setIndex((i) => (i > 0 ? i - 1 : i));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [available.length, onFinish]);

  if (!step || typeof document === 'undefined') return null;

  const pos = cardPosition(rect, step.placement ?? 'bottom', cardH);
  const highlight = rect
    ? { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }
    : null;

  return createPortal(
    <div className="fixed inset-0 z-[150]" aria-live="polite">
      {/* Dim everything; the highlight cuts a hole with a giant shadow. */}
      {highlight ? (
        <div
          className="pointer-events-none fixed rounded-xl ring-2 ring-white/90 transition-all duration-200 motion-reduce:transition-none"
          style={{ ...highlight, boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.55)' }}
        />
      ) : (
        <div className="fixed inset-0 bg-slate-900/55" />
      )}
      {/* Swallow clicks outside the card so the page isn't changed mid-tour. */}
      <div className="fixed inset-0" onClick={(e) => e.stopPropagation()} />

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`tour-${tour}-title`}
        aria-describedby={`tour-${tour}-body`}
        className="fixed rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-black/5 transition-[top,left] duration-200 motion-reduce:transition-none"
        style={{ top: pos.top, left: pos.left, width: pos.width }}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-600">
            {t('stepOf', { current: index + 1, total: available.length })}
          </p>
          <button
            type="button"
            onClick={onFinish}
            aria-label={t('close')}
            className="-mr-1 -mt-1 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={14} weight="bold" />
          </button>
        </div>
        <h2 id={`tour-${tour}-title`} className="mt-2 text-base font-semibold text-gray-900">
          {t(`tours.${tour}.${step.key}.title`)}
        </h2>
        <p id={`tour-${tour}-body`} className="mt-1.5 text-sm leading-6 text-gray-600">
          {t(`tours.${tour}.${step.key}.body`)}
        </p>

        <div className="mt-4 flex items-center justify-between gap-2">
          {isLast ? (
            <span />
          ) : (
            <button
              type="button"
              onClick={onFinish}
              className="text-xs font-medium text-gray-400 hover:text-gray-700"
            >
              {t('skip')}
            </button>
          )}
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={() => setIndex(index - 1)}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                {t('back')}
              </button>
            )}
            <button
              ref={nextRef}
              type="button"
              onClick={() => (isLast ? onFinish() : setIndex(index + 1))}
              className="rounded-lg bg-gray-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2"
            >
              {isLast ? t('finish') : t('next')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
