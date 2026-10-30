'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Check, SpinnerGap, Warning } from '@phosphor-icons/react';
import { useFormat } from '@/hooks/useFormat';
import { SENDER_ID_PRICE_EUR } from '@/lib/billing/addons';

export type SenderIdStanje = {
  dovoljen: boolean;
  ime: string | null;
  status: string | null;
  opomba: string | null;
  v_uporabi: string | null;
  moze_kupiti: boolean;
  dodatek: boolean;
};

/** Loads the sender-ID state from the API; `reload` refreshes it after a change. */
export function useSenderIdStanje() {
  const [stanje, setStanje] = useState<SenderIdStanje | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const res = await fetch('/api/sender-id', { cache: 'no-store' });
      const data = await res.json();
      setStanje(res.ok && data.ok ? (data.stanje as SenderIdStanje) : null);
    } catch {
      setStanje(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { stanje, loading, reload };
}

interface SenderIdPanelProps {
  stanje: SenderIdStanje | null;
  /** Whether the subscription can be charged through Stripe. */
  canPurchase: boolean;
  onChanged: () => Promise<void> | void;
  onToast: (message: string, type?: 'success' | 'error') => void;
}

type NameCheck = { state: 'idle' | 'checking' | 'free' | 'taken'; message?: string };

export function SenderIdPanel({ stanje, canPurchase, onChanged, onToast }: SenderIdPanelProps) {
  const t = useTranslations('billing.addons.senderId');
  const f = useFormat();
  const [ime, setIme] = useState('');
  const [check, setCheck] = useState<NameCheck>({ state: 'idle' });
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [editing, setEditing] = useState(false);

  const price = f.money(SENDER_ID_PRICE_EUR, { whole: true });
  const status = stanje?.status ?? 'ni_zaproseno';

  // The name field is shown when nothing is requested yet, after a rejection,
  // or when the owner chose to change the name.
  const showForm = !!stanje && (stanje.moze_kupiti || stanje.dovoljen) && (editing || status === 'ni_zaproseno' || status === 'zavrnjeno');

  // Debounced availability check as the owner types.
  useEffect(() => {
    const value = ime.trim();
    if (!value) {
      setCheck({ state: 'idle' });
      return;
    }
    setCheck({ state: 'checking' });
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/sender-id?ime=${encodeURIComponent(value)}`, { cache: 'no-store' });
        const data = await res.json();
        if (data.ok && data.prosto) setCheck({ state: 'free' });
        else setCheck({ state: 'taken', message: data.razlog });
      } catch {
        setCheck({ state: 'taken', message: t('checkError') });
      }
    }, 450);
    return () => clearTimeout(handle);
  }, [ime, t]);

  if (!stanje) {
    return <p className="text-sm text-gray-500">{t('loadError')}</p>;
  }

  // Free and Plus: show the offer, but the add-on needs Pro.
  if (!stanje.moze_kupiti && !stanje.dovoljen) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-sm leading-6 text-gray-600">{t('lockedPro', { price })}</p>
        <Link
          href="/nastavitve/paketi#razpolozljivi-paketi"
          className="inline-flex rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
        >
          {t('upgrade')}
        </Link>
      </div>
    );
  }

  const submit = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/sender-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ime: ime.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.razlog ?? t('submitError'));
      onToast(t('toast.requested'));
      setIme('');
      setEditing(false);
      setCheck({ state: 'idle' });
    } catch (e) {
      onToast(e instanceof Error ? e.message : t('submitError'), 'error');
    } finally {
      setBusy(false);
    }
    await onChanged();
  };

  const cancel = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/sender-id', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.razlog ?? t('cancelError'));
      onToast(t('toast.canceled'));
    } catch (e) {
      onToast(e instanceof Error ? e.message : t('cancelError'), 'error');
    } finally {
      setBusy(false);
      setConfirmCancel(false);
    }
    await onChanged();
  };

  const canSubmit = check.state === 'free' && !busy && (stanje.dodatek || stanje.dovoljen || canPurchase);

  return (
    <div className="space-y-4">
      <p className="max-w-prose text-sm leading-6 text-gray-600">{t('body')}</p>

      {/* Current state */}
      {stanje.ime && !showForm && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[10px] border border-gray-200 bg-white px-4 py-3">
          <span className="font-mono text-sm font-semibold text-gray-900">{stanje.ime}</span>
          <span className="text-[13px] text-gray-600">
            {status === 'odobreno'
              ? t('status.odobreno', { ime: stanje.ime })
              : status === 'v_obdelavi'
              ? t('status.v_obdelavi')
              : status === 'zavrnjeno'
              ? t('status.zavrnjeno', { opomba: stanje.opomba ?? '—' })
              : ''}
          </span>
        </div>
      )}

      {status === 'zavrnjeno' && stanje.opomba && showForm && (
        <div className="flex items-start gap-2 rounded-[10px] bg-amber-50 p-3">
          <Warning className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" weight="regular" />
          <p className="text-xs text-amber-800">{t('status.zavrnjeno', { opomba: stanje.opomba })}</p>
        </div>
      )}

      {/* Name form */}
      {showForm && (
        <div>
          <label htmlFor="sender-id-ime" className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            {t('inputLabel')}
          </label>
          <div className="mt-2 flex flex-wrap items-start gap-2">
            <div className="min-w-[200px] flex-1">
              <input
                id="sender-id-ime"
                value={ime}
                maxLength={11}
                autoComplete="off"
                onChange={(e) => setIme(e.target.value)}
                placeholder={t('inputPlaceholder')}
                className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 font-mono text-sm text-gray-900 placeholder:font-sans placeholder:text-gray-400 focus:border-[#7C78FA] focus:outline-none focus:ring-[3px] focus:ring-[#7C78FA]/25"
              />
              <p className="mt-1.5 min-h-[1.25rem] text-xs">
                {check.state === 'checking' && (
                  <span className="inline-flex items-center gap-1 text-gray-500">
                    <SpinnerGap className="h-3.5 w-3.5 animate-spin" weight="bold" />
                    {t('checking')}
                  </span>
                )}
                {check.state === 'free' && (
                  <span className="inline-flex items-center gap-1 font-medium text-emerald-600">
                    <Check className="h-3.5 w-3.5" weight="bold" />
                    {t('free')}
                  </span>
                )}
                {check.state === 'taken' && <span className="font-medium text-red-600">{check.message}</span>}
                {check.state === 'idle' && <span className="text-gray-400">{t('rules')}</span>}
              </p>
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {busy ? (
                <>
                  <SpinnerGap className="h-4 w-4 animate-spin" weight="bold" />
                  {t('activating')}
                </>
              ) : stanje.dodatek ? (
                t('requestName')
              ) : (
                t('activate', { price })
              )}
            </button>
          </div>
          {!stanje.dodatek && !stanje.dovoljen && <p className="mt-2 text-xs leading-5 text-gray-500">{t('purchaseNote')}</p>}
          {editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setIme('');
              }}
              className="mt-2 text-xs font-medium text-gray-500 hover:text-gray-800"
            >
              {t('keepName')}
            </button>
          )}
        </div>
      )}

      {/* Actions on an existing request */}
      {!showForm && stanje.dodatek && (
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={busy}
            className="text-sm font-medium text-[#6D5EF7] transition-colors hover:text-[#5a4ce0] disabled:opacity-50"
          >
            {t('changeName')}
          </button>
          {!confirmCancel ? (
            <button
              type="button"
              onClick={() => setConfirmCancel(true)}
              disabled={busy}
              className="text-sm font-medium text-red-500 transition-colors hover:text-red-700 disabled:opacity-50"
            >
              {t('cancel')}
            </button>
          ) : (
            <span className="inline-flex items-center gap-2 text-xs">
              <span className="font-medium text-gray-700">{t('cancelConfirm')}</span>
              <button
                type="button"
                onClick={cancel}
                disabled={busy}
                className="rounded-lg bg-red-600 px-2.5 py-1 font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {busy ? t('canceling') : t('cancel')}
              </button>
              <button type="button" onClick={() => setConfirmCancel(false)} className="font-medium text-gray-500 hover:text-gray-800">
                {t('cancelKeep')}
              </button>
            </span>
          )}
        </div>
      )}

      {stanje.dodatek && <p className="text-xs leading-5 text-gray-500">{t('cancelNote')}</p>}
    </div>
  );
}
