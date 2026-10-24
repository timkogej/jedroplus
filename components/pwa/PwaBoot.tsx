'use client';

import { useEffect } from 'react';
import { startInstallPromptCapture } from '@/lib/pwa/installPrompt';

/**
 * Brskalnik ponudi namestitev (beforeinstallprompt) samo enkrat ob nalaganju
 * strani — zato ga ujamemo že v korenskem layoutu, tudi na prijavi.
 */
export function PwaBoot() {
  useEffect(() => {
    startInstallPromptCapture();
  }, []);
  return null;
}
