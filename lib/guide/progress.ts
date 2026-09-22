// lib/guide/progress.ts
//
// Per-user guidance state kept in the browser: which guided tours someone has
// finished, which key pages they have opened (used to tick "getting started"
// items that can't be detected from data), and whether they hid the checklist.

export type TourId = 'dashboard' | 'calendar' | 'staff';
export type VisitKey = 'workingHours' | 'reminders' | 'team';

interface GuideState {
  tours: Partial<Record<TourId, true>>;
  visited: Partial<Record<VisitKey, true>>;
  checklistHidden?: true;
}

const KEY = (userId: string) => `jedroplus_guide:${userId}`;
const EVENT = 'jedroplus:guide-change';

function read(userId: string | null | undefined): GuideState {
  if (!userId) return { tours: {}, visited: {} };
  try {
    const raw = localStorage.getItem(KEY(userId));
    const parsed = raw ? (JSON.parse(raw) as Partial<GuideState>) : {};
    return { tours: parsed.tours ?? {}, visited: parsed.visited ?? {}, checklistHidden: parsed.checklistHidden };
  } catch {
    return { tours: {}, visited: {} };
  }
}

function write(userId: string, state: GuideState) {
  try {
    localStorage.setItem(KEY(userId), JSON.stringify(state));
  } catch {
    // storage unavailable — guidance simply shows again next time
  }
  window.dispatchEvent(new Event(EVENT));
}

export function getGuideState(userId: string | null | undefined): GuideState {
  return read(userId);
}

export function isTourDone(userId: string | null | undefined, tour: TourId): boolean {
  return Boolean(read(userId).tours[tour]);
}

export function markTourDone(userId: string | null | undefined, tour: TourId) {
  if (!userId) return;
  const state = read(userId);
  state.tours[tour] = true;
  write(userId, state);
}

export function markVisited(userId: string | null | undefined, key: VisitKey) {
  if (!userId) return;
  const state = read(userId);
  if (state.visited[key]) return;
  state.visited[key] = true;
  write(userId, state);
}

export function hideChecklist(userId: string | null | undefined) {
  if (!userId) return;
  const state = read(userId);
  state.checklistHidden = true;
  write(userId, state);
}

/** Subscribe to changes made anywhere in the app (same tab). */
export function onGuideChange(listener: () => void): () => void {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
