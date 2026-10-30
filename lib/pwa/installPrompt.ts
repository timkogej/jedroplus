// lib/pwa/installPrompt.ts
//
// Chrome, Edge in Samsung Internet ob nalaganju sprožijo `beforeinstallprompt`
// samo enkrat. Ujamemo ga čim prej (PwaBoot v korenskem layoutu) in ga
// hranimo tu, da ga lahko kasneje uporabi vodič za namestitev.

import { isStandaloneDisplay } from './device';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface InstallState {
  canPrompt: boolean;
  installed: boolean;
}

let deferred: BeforeInstallPromptEvent | null = null;
let state: InstallState = { canPrompt: false, installed: false };
const listeners = new Set<() => void>();
let started = false;

function set(next: Partial<InstallState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

export function startInstallPromptCapture() {
  if (started || typeof window === 'undefined') return;
  started = true;
  state = { canPrompt: false, installed: isStandaloneDisplay() };

  window.addEventListener('beforeinstallprompt', (e) => {
    // Brskalnikove pasice ne pokažemo — namesto nje je naš vodič.
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    set({ canPrompt: true });
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    set({ canPrompt: false, installed: true });
  });
}

export function subscribeInstallState(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getInstallState(): InstallState {
  return state;
}

const SERVER_STATE: InstallState = { canPrompt: false, installed: false };
export function getServerInstallState(): InstallState {
  return SERVER_STATE;
}

/** Pokaže brskalnikovo okno "Namesti". Vrne izbiro uporabnika. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferred) return 'unavailable';
  const ev = deferred;
  deferred = null;
  set({ canPrompt: false });
  await ev.prompt();
  const { outcome } = await ev.userChoice;
  if (outcome === 'accepted') set({ installed: true });
  return outcome;
}
