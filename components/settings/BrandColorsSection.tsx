'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, SpinnerGap, Warning } from '@phosphor-icons/react';
import { SettingsSection } from '@/components/settings';
import { brandPalette, normalizeHex } from '@/lib/brandColors';

interface BrandColorsSectionProps {
  initialPrimary: string;
  initialSecondary: string;
}

const FALLBACK_PRIMARY = '#6D5EF7';
const FALLBACK_SECOND = '#18C6B8';

/**
 * The company's two colours, set once. They colour the booking pages and every
 * email sent to clients. The preview below uses the same readability rules as
 * the emails, so what you see here is what clients get.
 */
export default function BrandColorsSection({ initialPrimary, initialSecondary }: BrandColorsSectionProps) {
  const t = useTranslations('settings.company.brandColors');
  const [primary, setPrimary] = useState(normalizeHex(initialPrimary) || FALLBACK_PRIMARY);
  const [second, setSecond] = useState(normalizeHex(initialSecondary) || FALLBACK_SECOND);
  const [saved, setSaved] = useState({ p: normalizeHex(initialPrimary) || FALLBACK_PRIMARY, s: normalizeHex(initialSecondary) || FALLBACK_SECOND });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const p = normalizeHex(initialPrimary) || FALLBACK_PRIMARY;
    const s = normalizeHex(initialSecondary) || FALLBACK_SECOND;
    setPrimary(p);
    setSecond(s);
    setSaved({ p, s });
  }, [initialPrimary, initialSecondary]);

  const valid = !!normalizeHex(primary) && !!normalizeHex(second);
  const dirty = normalizeHex(primary) !== saved.p || normalizeHex(second) !== saved.s;
  const palette = useMemo(() => brandPalette(primary, second), [primary, second]);

  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const res = await fetch('/api/company/brand-colors', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primary: normalizeHex(primary), secondary: normalizeHex(second) }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean };
      if (!res.ok || !data.ok) {
        setError(t('saveError'));
        return;
      }
      setSaved({ p: normalizeHex(primary), s: normalizeHex(second) });
      setDone(true);
    } catch {
      setError(t('saveError'));
    } finally {
      setBusy(false);
    }
  };

  const field = (label: string, desc: string, value: string, set: (v: string) => void, id: string) => (
    <div className="flex-1 min-w-[220px]">
      <label htmlFor={id} className="text-sm font-medium text-gray-900">{label}</label>
      <p className="mb-2 text-xs text-gray-500">{desc}</p>
      <div className="flex items-center gap-3">
        <input
          type="color"
          aria-label={label}
          value={normalizeHex(value) || '#000000'}
          onChange={(e) => { set(e.target.value); setDone(false); }}
          className="h-10 w-10 cursor-pointer rounded-lg border border-gray-200 bg-white p-0.5"
        />
        <input
          id={id}
          value={value}
          onChange={(e) => { set(e.target.value); setDone(false); }}
          spellCheck={false}
          maxLength={7}
          className={`h-10 w-28 rounded-lg border bg-white px-3 text-sm uppercase text-gray-900 outline-none focus:border-gray-400 ${
            normalizeHex(value) ? 'border-gray-200' : 'border-red-300'
          }`}
        />
      </div>
    </div>
  );

  return (
    <SettingsSection title={t('title')} description={t('subtitle')}>
      <div className="space-y-5 py-2">
        <div className="flex flex-wrap gap-6">
          {field(t('primaryLabel'), t('primaryDesc'), primary, setPrimary, 'brand-primary')}
          {field(t('secondLabel'), t('secondDesc'), second, setSecond, 'brand-second')}
        </div>

        {/* Mini email, built from the same palette as the real ones. */}
        <div className="rounded-xl bg-[#F3F4F6] p-4">
          <p className="mb-2 text-xs font-medium text-gray-500">{t('previewTitle')}</p>
          <div className="mx-auto max-w-sm overflow-hidden rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-3 h-[3px] w-9 rounded" style={{ background: palette.second }} />
            <p className="text-lg font-semibold tracking-tight text-gray-900">{t('previewHeading')}</p>
            <span
              className="mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-bold"
              style={{ background: palette.secondTint, color: palette.secondText }}
            >
              {t('previewTag')}
            </span>
            <p className="mt-3 text-sm" style={{ color: palette.text }}>{t('previewLink')}</p>
            <div
              className="mt-4 inline-block rounded-lg px-5 py-2.5 text-sm font-semibold"
              style={{ background: palette.primary, color: palette.onPrimary }}
            >
              {t('previewButton')}
            </div>
          </div>
        </div>

        {palette.primaryTooLight && (
          <div className="flex items-start gap-2 rounded-[10px] bg-amber-50 p-3">
            <Warning className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" weight="regular" />
            <p className="text-xs leading-5 text-amber-900">{t('tooLight')}</p>
          </div>
        )}
        {!valid && <p className="text-sm text-red-600">{t('invalid')}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={!valid || !dirty || busy}
            className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-40"
          >
            {busy && <SpinnerGap className="h-4 w-4 animate-spin" weight="bold" />}
            {t('save')}
          </button>
          {done && !dirty && (
            <span role="status" className="inline-flex items-center gap-1 text-sm text-emerald-600">
              <Check className="h-4 w-4" weight="bold" /> {t('saved')}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400">{t('usedIn')}</p>
      </div>
    </SettingsSection>
  );
}
