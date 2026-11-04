'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CircleNotch } from '@phosphor-icons/react';
import type { Location } from '@/types/locations';

type Props = {
  /** Active locations of the company. */
  locations: Location[];
  /** How many may stay active. */
  allowed: number;
  /** Called after the surplus locations were archived. */
  onDone: () => void;
  onCancel?: () => void;
};

/**
 * The owner chooses which locations stay when the plan (or the add-on) allows
 * fewer than are active. The others are archived: hidden and not bookable,
 * but nothing is deleted and they come back when the limit allows it again.
 */
export function ReduceLocations({ locations, allowed, onDone, onCancel }: Props) {
  const t = useTranslations('settings.locations.reduce');
  const ordered = useMemo(
    () => [...locations].sort((a, b) => Number(b.je_glavna) - Number(a.je_glavna) || a.zaporedje - b.zaporedje),
    [locations]
  );
  const [keep, setKeep] = useState<string[]>(() => ordered.slice(0, allowed).map((l) => l.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const toggle = (id: string) => {
    setKeep((prev) => {
      if (prev.includes(id)) return prev.length > 1 ? prev.filter((v) => v !== id) : prev;
      return prev.length < allowed ? [...prev, id] : prev;
    });
  };

  const mainKept = ordered.find((l) => l.je_glavna && keep.includes(l.id));
  const newMain = mainKept ?? ordered.find((l) => keep.includes(l.id));
  const toArchive = ordered.filter((l) => !keep.includes(l.id));

  const patch = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/locations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; count?: number };
    return { ok: res.ok && data.ok === true, error: data.error, count: data.count };
  };

  const submit = async () => {
    if (!newMain || toArchive.length === 0) return;
    setBusy(true);
    setError('');
    try {
      // The main location cannot be archived: make a kept one the main first.
      if (!mainKept) {
        const made = await patch({ id: newMain.id, action: 'make_main' });
        if (!made.ok) { setError(t('errSave')); return; }
      }
      for (const l of toArchive) {
        const done = await patch({ id: l.id, action: 'archive' });
        if (!done.ok) {
          setError(done.error === 'has_upcoming_appointments'
            ? t('errUpcoming', { name: l.naziv, count: done.count ?? 0 })
            : t('errSave'));
          return;
        }
      }
      onDone();
    } catch {
      setError(t('errSave'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
      <p className="text-sm font-semibold text-gray-900">{t('title', { allowed })}</p>
      <p className="mt-1 text-xs text-gray-600">{t('help')}</p>
      <div className="mt-3 space-y-1">
        {ordered.map((l) => {
          const checked = keep.includes(l.id);
          return (
            <label key={l.id} className="flex min-h-[36px] cursor-pointer items-center gap-2.5 text-sm text-gray-800">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(l.id)}
                disabled={busy || (!checked && keep.length >= allowed)}
                className="h-4 w-4 accent-violet-600"
              />
              <span>{l.naziv}</span>
              {newMain?.id === l.id && checked && (
                <span className="text-xs text-gray-500">{t('mainTag')}</span>
              )}
            </label>
          );
        })}
      </div>
      {toArchive.length > 0 && (
        <p className="mt-2 text-xs text-gray-600">
          {t('willArchive', { names: toArchive.map((l) => l.naziv).join(', ') })}
        </p>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy || toArchive.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3.5 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {busy && <CircleNotch className="h-3.5 w-3.5 animate-spin" />}
          {t('confirm', { count: toArchive.length })}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-white/70 disabled:opacity-50"
          >
            {t('cancel')}
          </button>
        )}
      </div>
    </div>
  );
}
