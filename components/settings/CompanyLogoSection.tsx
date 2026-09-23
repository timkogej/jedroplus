'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { SpinnerGap, Trash, UploadSimple, Warning } from '@phosphor-icons/react';
import { SettingsSection } from '@/components/settings';

const SUPPORT_EMAIL = 'info@jedroplus.com';
const MAX_BYTES = 1024 * 1024;
const ACCEPT = 'image/png,image/webp,image/svg+xml,image/jpeg';

interface CompanyLogoSectionProps {
  /** Logo already saved for this company, if any. */
  initialUrl: string | null;
}

/**
 * A logo on a coloured or dark booking page only looks right when it has a
 * transparent background. Most small businesses only have a JPG exported from
 * Facebook, so we check the file in the browser before uploading and say
 * plainly what it will look like, instead of letting the client discover a
 * white box on the booking page.
 */
export default function CompanyLogoSection({ initialUrl }: CompanyLogoSectionProps) {
  const t = useTranslations('settings.company.logo');
  const inputRef = useRef<HTMLInputElement>(null);

  const [url, setUrl] = useState<string | null>(initialUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opaque, setOpaque] = useState(false);

  useEffect(() => setUrl(initialUrl), [initialUrl]);

  /** True when the image has no see-through pixels along its edges. */
  const looksOpaque = useCallback(async (file: File): Promise<boolean> => {
    if (file.type === 'image/svg+xml') return false; // vector logos are normally cut out
    if (file.type === 'image/jpeg') return true; // JPEG cannot store transparency
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      const size = 64;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      ctx.drawImage(bitmap, 0, 0, size, size);
      const { data } = ctx.getImageData(0, 0, size, size);
      // Look at the border ring: a cut-out logo is transparent there.
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const edge = x === 0 || y === 0 || x === size - 1 || y === size - 1;
          if (!edge) continue;
          if (data[(y * size + x) * 4 + 3] < 250) return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  const upload = async (file: File) => {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError(t('errors.tooLarge'));
      return;
    }
    setBusy(true);
    try {
      setOpaque(await looksOpaque(file));
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/company/logo', { method: 'POST', body });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
      if (!res.ok || !data.ok || !data.url) {
        setError(data.error === 'unsupported_type' ? t('errors.unsupported') : t('errors.failed'));
        return;
      }
      setUrl(data.url);
    } catch {
      setError(t('errors.failed'));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/company/logo', { method: 'DELETE' });
      if (!res.ok) {
        setError(t('errors.failed'));
        return;
      }
      setUrl(null);
      setOpaque(false);
    } catch {
      setError(t('errors.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsSection title={t('title')} description={t('subtitle')}>
      <div className="space-y-4 py-2">
        {url ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {(['light', 'dark'] as const).map((mode) => (
              <div
                key={mode}
                className={`flex h-28 items-center justify-center rounded-xl border ${
                  mode === 'light' ? 'border-gray-200 bg-white' : 'border-gray-800 bg-gray-900'
                }`}
              >
                {/* Remote host is Supabase storage; a plain img avoids next/image config. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={t('previewAlt')} className="max-h-16 max-w-[70%] object-contain" />
              </div>
            ))}
            <p className="text-xs text-gray-500 sm:col-span-2">{t('previewNote')}</p>
          </div>
        ) : (
          <p className="text-sm text-gray-500">{t('emptyState')}</p>
        )}

        {opaque && url && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <Warning className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" weight="fill" />
            <div className="text-xs leading-5 text-amber-900">
              <p className="font-semibold">{t('opaqueTitle')}</p>
              <p className="mt-0.5">{t('opaqueBody')}</p>
              <p className="mt-1">
                {t('helpPrefix')}{' '}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold underline underline-offset-2">
                  {SUPPORT_EMAIL}
                </a>
              </p>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            id="company-logo-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload(file);
            }}
          />
          <label
            htmlFor="company-logo-input"
            className={`inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#0a0a0a] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1f1f1f] ${
              busy ? 'pointer-events-none opacity-60' : ''
            }`}
          >
            {busy ? <SpinnerGap className="h-4 w-4 animate-spin" weight="bold" /> : <UploadSimple className="h-4 w-4" />}
            {url ? t('replace') : t('upload')}
          </label>

          {url && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <Trash className="h-4 w-4" />
              {t('remove')}
            </button>
          )}

          <p className="text-xs text-gray-400">{t('requirements')}</p>
        </div>
      </div>
    </SettingsSection>
  );
}
