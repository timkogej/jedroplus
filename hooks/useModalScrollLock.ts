'use client';

import { useEffect } from 'react';

let activeLocks = 0;
let scrollY = 0;
let previousBodyOverflow = '';
let previousBodyPosition = '';
let previousBodyTop = '';
let previousBodyWidth = '';
let previousHtmlOverscrollBehavior = '';

export function useModalScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked || typeof window === 'undefined') return;

    const body = document.body;
    const html = document.documentElement;

    if (activeLocks === 0) {
      scrollY = window.scrollY;
      previousBodyOverflow = body.style.overflow;
      previousBodyPosition = body.style.position;
      previousBodyTop = body.style.top;
      previousBodyWidth = body.style.width;
      previousHtmlOverscrollBehavior = html.style.overscrollBehavior;

      body.style.overflow = 'hidden';
      body.style.position = 'fixed';
      body.style.top = `-${scrollY}px`;
      body.style.width = '100%';
      html.style.overscrollBehavior = 'none';
    }

    activeLocks += 1;

    return () => {
      activeLocks = Math.max(0, activeLocks - 1);

      if (activeLocks === 0) {
        body.style.overflow = previousBodyOverflow;
        body.style.position = previousBodyPosition;
        body.style.top = previousBodyTop;
        body.style.width = previousBodyWidth;
        html.style.overscrollBehavior = previousHtmlOverscrollBehavior;
        window.scrollTo(0, scrollY);
      }
    };
  }, [isLocked]);
}
