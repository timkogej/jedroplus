'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle, WarningCircle, XCircle } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';

type Status = 'idle' | 'checking' | 'valid' | 'invalid' | 'unavailable' | 'bad_format';

interface VatVerifyProps {
  vat: string;
  /** "Podatki podjetij".vat_verified from the last check, if any. */
  initiallyVerified: boolean | null;
  disabled?: boolean;
}

/**
 * Checks the VAT number in the EU register (VIES). A verified number from
 * another EU country lets billing leave VAT off the invoice (reverse charge).
 */
export function VatVerify({ vat, initiallyVerified, disabled = false }: VatVerifyProps) {
  const t = useTranslations('settings.company.vat');
  const [status, setStatus] = useState<Status>('idle');
  const [name, setName] = useState<string | null>(null);
  const checkedVat = useRef<string | null>(null);

  // The stored result belongs to the stored number; editing it resets.
  useEffect(() => {
    if (checkedVat.current === null && vat) {
      checkedVat.current = vat;
      if (initiallyVerified !== null) setStatus(initiallyVerified ? 'valid' : 'invalid');
      return;
    }
    if (vat !== checkedVat.current) {
      setStatus('idle');
      setName(null);
    }
  }, [vat, initiallyVerified]);

  const check = async () => {
    setStatus('checking');
    try {
      const res = await fetch('/api/company/vat-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vat }),
      });
      const body = (await res.json().catch(() => null)) as { status?: Status; name?: string | null } | null;
      checkedVat.current = vat;
      setStatus(res.ok && body?.status ? body.status : 'unavailable');
      setName(body?.name ?? null);
    } catch {
      setStatus('unavailable');
    }
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <button
        type="button"
        onClick={check}
        disabled={disabled || !vat.trim() || status === 'checking'}
        className="rounded-md border border-gray-200 bg-white px-2.5 py-1 font-medium text-gray-700 hover:border-gray-300 hover:text-gray-900 disabled:opacity-50"
      >
        {status === 'checking' ? t('checking') : t('check')}
      </button>
      {status === 'valid' && (
        <span className="inline-flex items-center gap-1 text-emerald-700">
          <CheckCircle className="h-3.5 w-3.5" weight="fill" />
          {name ? t('validWithName', { name }) : t('valid')}
        </span>
      )}
      {status === 'invalid' && (
        <span className="inline-flex items-center gap-1 text-red-600">
          <XCircle className="h-3.5 w-3.5" weight="fill" />
          {t('invalid')}
        </span>
      )}
      {status === 'bad_format' && (
        <span className="inline-flex items-center gap-1 text-red-600">
          <XCircle className="h-3.5 w-3.5" weight="fill" />
          {t('badFormat')}
        </span>
      )}
      {status === 'unavailable' && (
        <span className="inline-flex items-center gap-1 text-amber-700">
          <WarningCircle className="h-3.5 w-3.5" weight="fill" />
          {t('unavailable')}
        </span>
      )}
    </div>
  );
}
