'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslations } from 'next-intl';
import { Check, MagnifyingGlassMinus, MagnifyingGlassPlus, SpinnerGap, X } from '@phosphor-icons/react';
import { BodyPortal } from '@/components/ui/BodyPortal';
import { SHAPES, renderCrop, type ImageShape } from './imageProcessing';

/** Crop position, kept relative to the frame so it survives a resize. */
export interface CropState {
  zoom: number;
  /** Image centre offset from the frame centre, in frame widths / heights. */
  x: number;
  y: number;
}

export const INITIAL_CROP: CropState = { zoom: 1, x: 0, y: 0 };

const MAX_ZOOM = 4;
const PAD = 24;

interface ImageCropperProps {
  open: boolean;
  img: HTMLImageElement | null;
  shape: ImageShape;
  initial?: CropState;
  onCancel: () => void;
  onApply: (blob: Blob, crop: CropState) => void;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Full-screen editor to place a photo in the frame: drag to move, pinch,
 * scroll or the slider to zoom, arrow keys and +/- on a keyboard. The frame
 * always stays covered by the photo, so there are never empty edges.
 */
export default function ImageCropper({ open, img, shape, initial, onCancel, onApply }: ImageCropperProps) {
  const t = useTranslations('common.media');
  const stageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [crop, setCrop] = useState<CropState>(initial ?? INITIAL_CROP);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; zoom: number; mid: { x: number; y: number } } | null>(null);

  useEffect(() => {
    if (open) {
      setCrop(initial ?? INITIAL_CROP);
      setBusy(false);
    }
  }, [open, initial]);

  // Measure the stage; the frame is sized from it.
  useLayoutEffect(() => {
    if (!open) return;
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setStage({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  const { aspect } = SHAPES[shape];
  let frameW = Math.max(0, Math.min(stage.w - PAD * 2, 520));
  let frameH = frameW / aspect;
  if (frameH > stage.h - PAD * 2) {
    frameH = Math.max(0, stage.h - PAD * 2);
    frameW = frameH * aspect;
  }

  const nw = img?.naturalWidth ?? 1;
  const nh = img?.naturalHeight ?? 1;
  const base = frameW > 0 ? Math.max(frameW / nw, frameH / nh) : 0;

  /** Keeps the photo covering the frame at the given zoom. */
  const bound = useCallback(
    (next: CropState): CropState => {
      const zoom = clamp(next.zoom, 1, MAX_ZOOM);
      const s = base * zoom;
      const maxX = frameW > 0 ? Math.max(0, (nw * s - frameW) / 2) / frameW : 0;
      const maxY = frameH > 0 ? Math.max(0, (nh * s - frameH) / 2) / frameH : 0;
      return { zoom, x: clamp(next.x, -maxX, maxX), y: clamp(next.y, -maxY, maxY) };
    },
    [base, frameW, frameH, nw, nh]
  );

  /** Zooms keeping point `p` (px from the frame centre) where it is. */
  const zoomAt = useCallback(
    (prev: CropState, zoom: number, p = { x: 0, y: 0 }): CropState => {
      const z = clamp(zoom, 1, MAX_ZOOM);
      const ratio = z / prev.zoom;
      const ox = prev.x * frameW;
      const oy = prev.y * frameH;
      const nx = p.x - (p.x - ox) * ratio;
      const ny = p.y - (p.y - oy) * ratio;
      return bound({ zoom: z, x: frameW ? nx / frameW : 0, y: frameH ? ny / frameH : 0 });
    },
    [bound, frameW, frameH]
  );

  // Re-bound when the frame changes size (rotation, resize).
  useEffect(() => {
    setCrop((c) => bound(c));
  }, [bound]);

  const fromCentre = (clientX: number, clientY: number) => {
    const r = stageRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: clientX - (r.left + r.width / 2), y: clientY - (r.top + r.height / 2) };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setDragging(true);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        zoom: crop.zoom,
        mid: fromCentre((a.x + b.x) / 2, (a.y + b.y) / 2),
      };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const next = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, next);

    if (pointers.current.size >= 2 && gesture.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = fromCentre((a.x + b.x) / 2, (a.y + b.y) / 2);
      const g = gesture.current;
      const targetZoom = (g.zoom * dist) / Math.max(1, g.dist);
      // Two fingers moving together also move the photo.
      const panX = (mid.x - g.mid.x) / Math.max(1, frameW);
      const panY = (mid.y - g.mid.y) / Math.max(1, frameH);
      g.mid = mid;
      setCrop((c) => {
        const zoomed = zoomAt(c, targetZoom, mid);
        return bound({ ...zoomed, x: zoomed.x + panX, y: zoomed.y + panY });
      });
      return;
    }

    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    setCrop((c) => bound({ ...c, x: c.x + dx / Math.max(1, frameW), y: c.y + dy / Math.max(1, frameH) }));
  };

  const endPointer = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current = null;
    if (pointers.current.size === 0) setDragging(false);
  };

  // Wheel / trackpad zoom. Native listener: React's wheel handler is passive.
  useEffect(() => {
    const el = stageRef.current;
    if (!open || !el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = fromCentre(e.clientX, e.clientY);
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0025));
      setCrop((c) => zoomAt(c, c.zoom * factor, p));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [open, zoomAt]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.08 : 0.02;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (moves[e.key]) {
      e.preventDefault();
      const [dx, dy] = moves[e.key];
      setCrop((c) => bound({ ...c, x: c.x + dx, y: c.y + dy }));
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      setCrop((c) => zoomAt(c, c.zoom * 1.1));
    } else if (e.key === '-') {
      e.preventDefault();
      setCrop((c) => zoomAt(c, c.zoom / 1.1));
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  const apply = async () => {
    if (!img || base <= 0) return;
    setBusy(true);
    try {
      const s = base * crop.zoom;
      const width = frameW / s;
      const height = frameH / s;
      const x = clamp(nw / 2 - (crop.x * frameW) / s - width / 2, 0, nw - width);
      const y = clamp(nh / 2 - (crop.y * frameH) / s - height / 2, 0, nh - height);
      const blob = await renderCrop(img, { x, y, width, height }, shape);
      onApply(blob, crop);
    } catch {
      setBusy(false);
    }
  };

  const s = base * crop.zoom;
  const radius = shape === 'round' ? '9999px' : '14px';

  return (
    <BodyPortal>
      <AnimatePresence>
        {open && img && (
          <motion.div
            key="cropper"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
            data-no-sheet-drag
            // The cropper is portalled, but React still bubbles its events to
            // the form's modal; keep them here.
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (e.target === e.currentTarget && !busy) onCancel();
            }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={t('cropTitle')}
              initial={{ y: 40, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 30, opacity: 0, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              className="flex h-[88dvh] max-h-[760px] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl bg-[#1c1c1e] text-white shadow-2xl sm:h-[78vh] sm:rounded-2xl"
            >
              <div className="flex items-center justify-between px-5 pb-2 pt-4">
                <div>
                  <h3 className="text-[17px] font-semibold">{t('cropTitle')}</h3>
                  <p className="mt-0.5 text-[13px] text-white/55">{t('cropHint')}</p>
                </div>
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={busy}
                  aria-label={t('cancel')}
                  className="-m-1.5 rounded-full p-3 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div
                ref={stageRef}
                tabIndex={0}
                aria-label={t('cropHint')}
                onKeyDown={onKeyDown}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endPointer}
                onPointerCancel={endPointer}
                className={`relative min-h-0 flex-1 touch-none select-none overflow-hidden outline-none ${
                  dragging ? 'cursor-grabbing' : 'cursor-grab'
                }`}
              >
                {s > 0 && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={img.src}
                    alt=""
                    draggable={false}
                    className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
                    style={{
                      width: nw * s,
                      height: nh * s,
                      transform: `translate(calc(-50% + ${crop.x * frameW}px), calc(-50% + ${crop.y * frameH}px))`,
                    }}
                  />
                )}

                {/* Dimmed surroundings with the frame cut out. */}
                {frameW > 0 && (
                  <div
                    className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                    style={{
                      width: frameW,
                      height: frameH,
                      borderRadius: radius,
                      boxShadow: '0 0 0 9999px rgba(0,0,0,0.58)',
                      outline: '1.5px solid rgba(255,255,255,0.9)',
                    }}
                  >
                    {/* Thirds grid while moving, to help line things up. */}
                    <div
                      className="absolute inset-0 overflow-hidden transition-opacity duration-200"
                      style={{ borderRadius: radius, opacity: dragging ? 1 : 0 }}
                    >
                      {[1, 2].map((i) => (
                        <div key={`v${i}`} className="absolute bottom-0 top-0 w-px bg-white/35" style={{ left: `${(i * 100) / 3}%` }} />
                      ))}
                      {[1, 2].map((i) => (
                        <div key={`h${i}`} className="absolute left-0 right-0 h-px bg-white/35" style={{ top: `${(i * 100) / 3}%` }} />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setCrop((c) => zoomAt(c, c.zoom / 1.2))}
                    aria-label={t('zoomOut')}
                    className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <MagnifyingGlassMinus className="h-5 w-5" />
                  </button>
                  <input
                    type="range"
                    min={1}
                    max={MAX_ZOOM}
                    step={0.01}
                    value={crop.zoom}
                    aria-label={t('zoom')}
                    onChange={(e) => setCrop((c) => zoomAt(c, Number(e.target.value)))}
                    className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/20 accent-white"
                  />
                  <button
                    type="button"
                    onClick={() => setCrop((c) => zoomAt(c, c.zoom * 1.2))}
                    aria-label={t('zoomIn')}
                    className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <MagnifyingGlassPlus className="h-5 w-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={onCancel}
                    disabled={busy}
                    className="h-12 rounded-xl bg-white/10 text-[15px] font-medium text-white transition-colors hover:bg-white/15 disabled:opacity-50"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={apply}
                    disabled={busy}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white text-[15px] font-semibold text-gray-900 transition-transform hover:bg-white/90 active:scale-[0.98] disabled:opacity-60"
                  >
                    {busy ? <SpinnerGap className="h-4 w-4 animate-spin" weight="bold" /> : <Check className="h-4 w-4" weight="bold" />}
                    {t('apply')}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </BodyPortal>
  );
}
