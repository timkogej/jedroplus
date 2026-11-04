'use client';

import { ReduceLocations } from '@/components/locations/ReduceLocations';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { WorkingHoursEditor, parseWorkingHours, type WorkingHours } from '@/components/settings/WorkingHoursEditor';
import type { Location, LocationsResponse } from '@/types/locations';

type Draft = {
  naziv: string;
  naslov: string;
  telefon: string;
  email: string;
  povezava_ocena: string;
  cas_poti_min: string;
  urnik: WorkingHours;
};

const emptyDraft = (urnik?: string | null): Draft => ({
  naziv: '', naslov: '', telefon: '', email: '', povezava_ocena: '', cas_poti_min: '0',
  urnik: parseWorkingHours(urnik),
});

const draftFrom = (l: Location): Draft => ({
  naziv: l.naziv,
  naslov: l.naslov ?? '',
  telefon: l.telefon ?? '',
  email: l.email ?? '',
  povezava_ocena: l.povezava_ocena ?? '',
  cas_poti_min: String(l.cas_poti_min),
  urnik: parseWorkingHours(l.urnik),
});

export default function LocationsSettingsPage() {
  const t = useTranslations('settings.locations');
  const [locations, setLocations] = useState<Location[]>([]);
  const [max, setMax] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  // 'new' = creating, a location id = editing that one, null = nothing open.
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/locations', { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as LocationsResponse;
      setLocations(data.locations);
      setMax(data.max);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const active = locations.filter((l) => l.status === 'active').length;
  const atLimit = active >= max;
  // After a downgrade (or a cancelled add-on) more can be active than the plan allows.
  const overLimit = active > max;
  const [reducing, setReducing] = useState(false);

  const errorText = (code: string | undefined, count?: number) => {
    switch (code) {
      case 'limit_reached': return t('errLimit');
      case 'has_upcoming_appointments': return t('errUpcoming', { count: count ?? 0 });
      case 'main_cannot_be_archived': return t('errMain');
      case 'invalid_name': return t('errName');
      default: return t('errSave');
    }
  };

  const send = async (method: 'POST' | 'PATCH', body: Record<string, unknown>) => {
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/locations', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; count?: number };
      if (!res.ok || data.ok === false) {
        setMessage(errorText(data.error, data.count));
        return false;
      }
      await load();
      return true;
    } catch {
      setMessage(t('errSave'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const openNew = () => {
    // A new location starts from the main location's hours.
    setDraft(emptyDraft(locations.find((l) => l.je_glavna)?.urnik));
    setEditing('new');
    setMessage('');
  };

  const openEdit = (l: Location) => {
    setDraft(draftFrom(l));
    setEditing(l.id);
    setMessage('');
  };

  const saveDraft = async () => {
    if (!draft.naziv.trim()) {
      setMessage(t('errName'));
      return;
    }
    const fields = {
      naziv: draft.naziv,
      naslov: draft.naslov,
      telefon: draft.telefon,
      email: draft.email,
      povezava_ocena: draft.povezava_ocena,
      cas_poti_min: Number(draft.cas_poti_min) || 0,
      urnik: JSON.stringify(draft.urnik),
    };
    const ok = editing === 'new'
      ? await send('POST', fields)
      : await send('PATCH', { id: editing, ...fields });
    if (ok) setEditing(null);
  };

  const act = async (id: string, action: 'archive' | 'restore' | 'make_main', confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    await send('PATCH', { id, action });
  };

  const input = 'mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm';
  const label = 'block text-sm font-medium text-gray-900';

  const form = (
    <div className="space-y-4 border-t border-gray-100 p-5">
      <div>
        <label htmlFor="loc-name" className={label}>{t('fieldName')}</label>
        <input id="loc-name" className={input} maxLength={120} value={draft.naziv}
          onChange={(e) => setDraft({ ...draft, naziv: e.target.value })} />
      </div>
      <div>
        <label htmlFor="loc-address" className={label}>{t('fieldAddress')}</label>
        <input id="loc-address" className={input} maxLength={200} value={draft.naslov}
          onChange={(e) => setDraft({ ...draft, naslov: e.target.value })} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="loc-phone" className={label}>{t('fieldPhone')}</label>
          <input id="loc-phone" type="tel" className={input} maxLength={40} value={draft.telefon}
            onChange={(e) => setDraft({ ...draft, telefon: e.target.value })} />
        </div>
        <div>
          <label htmlFor="loc-email" className={label}>{t('fieldEmail')}</label>
          <input id="loc-email" type="email" className={input} maxLength={200} value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
        </div>
      </div>
      <div>
        <label htmlFor="loc-review" className={label}>{t('fieldReview')}</label>
        <input id="loc-review" type="url" className={input} maxLength={500} value={draft.povezava_ocena}
          onChange={(e) => setDraft({ ...draft, povezava_ocena: e.target.value })} />
      </div>
      <div>
        <label htmlFor="loc-travel" className={label}>{t('fieldTravel')}</label>
        <input id="loc-travel" type="number" min={0} max={240} className={`${input} w-32`} value={draft.cas_poti_min}
          onChange={(e) => setDraft({ ...draft, cas_poti_min: e.target.value })} />
        <p className="mt-1.5 text-xs text-gray-500">{t('fieldTravelHelp')}</p>
      </div>
      <div>
        <p className={label}>{t('fieldHours')}</p>
        <div className="mt-3">
          <WorkingHoursEditor value={draft.urnik} onChange={(urnik) => setDraft({ ...draft, urnik })} />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={saveDraft}
          className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50">
          {busy ? t('saving') : t('save')}
        </button>
        <button type="button" disabled={busy} onClick={() => setEditing(null)}
          className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 disabled:opacity-50">
          {t('cancel')}
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <Link href="/nastavitve" className="text-sm text-gray-500 hover:text-gray-900">← {t('back')}</Link>
      <h1 className="mt-5 text-2xl font-semibold text-gray-900">{t('title')}</h1>
      <p className="mt-1 text-sm text-gray-500">{t('subtitle')}</p>

      {loading ? (
        <p className="mt-7 text-sm text-gray-500">{t('loading')}</p>
      ) : loadFailed ? (
        <p role="alert" className="mt-7 text-sm text-gray-600">{t('loadError')}</p>
      ) : (
        <>
          <div className="mt-7 flex items-center justify-between gap-3">
            <p className="text-sm text-gray-500">{t('usage', { active, max })}</p>
            <button type="button" disabled={atLimit || busy} onClick={openNew}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
              {t('add')}
            </button>
          </div>
          {atLimit && (
            <p className="mt-3 text-sm text-gray-600">
              {t('limitReached', { max })}{' '}
              <Link href="/nastavitve/addoni" className="font-medium text-gray-900 underline">{t('addons')}</Link>
            </p>
          )}
          {overLimit && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
              <p className="text-sm font-semibold text-gray-900">{t('reduce.overTitle', { active, max })}</p>
              <p className="mt-1 text-xs text-gray-600">{t('reduce.overBody')}</p>
              {!reducing && (
                <button type="button" onClick={() => setReducing(true)}
                  className="mt-3 rounded-lg bg-gray-900 px-3.5 py-2 text-sm font-medium text-white">
                  {t('reduce.choose')}
                </button>
              )}
            </div>
          )}
          {overLimit && reducing && (
            <div className="mt-3">
              <ReduceLocations
                locations={locations.filter((l) => l.status === 'active')}
                allowed={max}
                onDone={() => { setReducing(false); void load(); }}
                onCancel={() => setReducing(false)}
              />
            </div>
          )}
          {message && <p role="status" className="mt-3 text-sm text-gray-600">{message}</p>}

          <div className="mt-5 space-y-3">
            {editing === 'new' && (
              <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
                <p className="px-5 pt-5 text-base font-semibold text-gray-900">{t('newTitle')}</p>
                {form}
              </div>
            )}
            {locations.map((l) => (
              <div key={l.id} className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
                <div className="flex flex-wrap items-start justify-between gap-3 p-5">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-gray-900">
                      {l.naziv}
                      {l.je_glavna && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{t('main')}</span>
                      )}
                      {l.status === 'archived' && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">{t('archivedBadge')}</span>
                      )}
                    </p>
                    {l.naslov && <p className="mt-0.5 text-sm text-gray-500">{l.naslov}</p>}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <button type="button" disabled={busy} onClick={() => openEdit(l)} className="font-medium text-gray-900 disabled:opacity-50">{t('edit')}</button>
                    {l.status === 'active' && !l.je_glavna && (
                      <button type="button" disabled={busy} onClick={() => act(l.id, 'make_main')} className="font-medium text-gray-600 disabled:opacity-50">{t('makeMain')}</button>
                    )}
                    {l.status === 'active' && !l.je_glavna && (
                      <button type="button" disabled={busy} onClick={() => act(l.id, 'archive', t('confirmArchive', { name: l.naziv }))} className="font-medium text-gray-600 disabled:opacity-50">{t('archive')}</button>
                    )}
                    {l.status === 'archived' && (
                      <button type="button" disabled={busy || atLimit} onClick={() => act(l.id, 'restore')} className="font-medium text-gray-600 disabled:opacity-40">{t('restore')}</button>
                    )}
                  </div>
                </div>
                {editing === l.id && form}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
