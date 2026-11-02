'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CircleNotch } from '@phosphor-icons/react';
import type { Location } from '@/types/locations';

type Props = {
  userId: string;
  locations: Location[];
  /** Locations the member is limited to; null = every location. */
  value: string[] | null;
  /** Called with the saved choice (null = every location). */
  onSaved: (userId: string, ids: string[] | null) => void;
};

/**
 * One line under a team member: where they may work, with an inline editor.
 * Only rendered when the company has several locations and for non-owners.
 */
export function MemberLocations({ userId, locations, value, onSaved }: Props) {
  const t = useTranslations('settings.members.locations');
  const everyId = locations.map((l) => l.id);
  const current = value && value.length > 0 ? value.filter((id) => everyId.includes(id)) : everyId;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const names = locations.filter((l) => current.includes(l.id)).map((l) => l.naziv);
  const summary = current.length === everyId.length ? t('all') : names.join(', ');

  const open = () => { setDraft(current); setError(false); setEditing(true); };

  const toggle = (id: string) => {
    if (draft.includes(id)) {
      if (draft.length > 1) setDraft(draft.filter((v) => v !== id));
    } else {
      setDraft([...draft, id]);
    }
  };

  const save = async () => {
    setSaving(true);
    setError(false);
    try {
      const res = await fetch('/api/locations/members', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, locations: draft }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean };
      if (!res.ok || !data.ok) throw new Error('save_failed');
      onSaved(userId, draft.length === everyId.length ? null : draft);
      setEditing(false);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
        <span>{t('label')}: <span className="font-medium text-gray-700">{summary}</span></span>
        <button type="button" onClick={open} className="font-medium text-violet-600 hover:underline">
          {t('edit')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg bg-gray-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{t('label')}</p>
      <div className="space-y-1.5">
        {locations.map((l) => (
          <label key={l.id} className="flex min-h-[32px] cursor-pointer items-center gap-2.5 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={draft.includes(l.id)}
              onChange={() => toggle(l.id)}
              disabled={saving}
              className="h-4 w-4 accent-violet-600"
            />
            <span>{l.naziv}</span>
          </label>
        ))}
      </div>
      <p className="text-xs text-gray-500">{t('help')}</p>
      {error && <p className="text-xs text-red-600">{t('saveError')}</p>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {saving && <CircleNotch className="h-3.5 w-3.5 animate-spin" />}
          {t('save')}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={saving}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
        >
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}
