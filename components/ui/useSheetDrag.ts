'use client';

/**
 * Poteg navzdol zapre list na telefonu — kot pri iOS listih.
 *
 * Uporaba v okencu:
 *   const drag = useSheetDrag(onClose);
 *   <motion.div ... {...drag.panel}>          ← plošča lista
 *     <div className={sheet.header} {...drag.handle}>  ← glava z ročajem
 *
 * Vleči se da samo za glavo (ročaj, naslov), ne za vsebino, da se drsenje po
 * obrazcu in vlečenje lista ne tepeta. Gumbi in polja v glavi (npr. X) ostanejo
 * navadni gumbi. Na širokem zaslonu (okno na sredini) vlečenja ni.
 */

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useDragControls, type PanInfo } from 'motion/react';

const PHONE_QUERY = '(max-width: 639px)';
const CLOSE_DISTANCE = 110; // px
const CLOSE_VELOCITY = 500; // px/s
const INTERACTIVE = 'button, a, input, select, textarea, label, [role="button"], [role="switch"], [contenteditable="true"], [data-no-sheet-drag]';

function useIsPhone() {
  const [isPhone, setIsPhone] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(PHONE_QUERY).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY);
    const update = () => setIsPhone(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return isPhone;
}

export function useSheetDrag(onClose: () => void, options: { disabled?: boolean } = {}) {
  const controls = useDragControls();
  const isPhone = useIsPhone();
  const enabled = isPhone && !options.disabled;
  // Ko list zapremo s potegom, naj odpelje navzdol od tam, kjer ga je prst
  // spustil, ne pa se vrne gor in zbledi.
  const [closedByDrag, setClosedByDrag] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!closedByDrag) return;
    onCloseRef.current();
    // Okenca, ki ostanejo naložena (isOpen), se lahko spet odprejo — takrat
    // morajo spet priti od spodaj. Odhajajoči list obdrži zadnje lastnosti.
    setClosedByDrag(false);
  }, [closedByDrag]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (!enabled) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest(INTERACTIVE)) return;
      controls.start(e);
    },
    [enabled, controls],
  );

  const onDragEnd = useCallback((_: unknown, info: PanInfo) => {
    if (info.offset.y > CLOSE_DISTANCE || (info.velocity.y > CLOSE_VELOCITY && info.offset.y > 24)) {
      setClosedByDrag(true);
    }
  }, []);

  const panel = enabled
    ? {
        drag: 'y' as const,
        dragControls: controls,
        dragListener: false,
        dragConstraints: { top: 0, bottom: 0 },
        dragElastic: { top: 0, bottom: 1 },
        dragMomentum: false,
        onDragEnd,
        ...(closedByDrag
          ? { exit: { y: '100%', opacity: 1, scale: 1, transition: { duration: 0.25, ease: [0.32, 0.72, 0, 1] as const } } }
          : {}),
      }
    : {};

  const handle = enabled
    ? { onPointerDown, style: { touchAction: 'none' as const, cursor: 'grab' } }
    : {};

  return { panel, handle };
}
