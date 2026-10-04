'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Check, Copy, EnvelopeSimple, WhatsappLogo, ChatText, X, Warning } from '@phosphor-icons/react';
import { useCompany } from '@/app/company-context';
import { buildInviteUrl } from '@/lib/team/invite';
import { sheet } from '@/components/ui/sheetClasses';

interface InviteDialogProps {
  open: boolean;
  onClose: () => void;
  /** People with a login right now, and how many the plan + add-ons allow. */
  usedSeats: number;
  maxSeats: number | null;
  isFree: boolean;
}

type Role = 'staff' | 'admin';

/**
 * "Invite to team": builds a personal link that carries the join code, ready
 * to send by email, WhatsApp or SMS. No codes to read out; joining creates the
 * person's staff card and links their login to it.
 */
export default function InviteDialog({ open, onClose, usedSeats, maxSeats, isFree }: InviteDialogProps) {
  const t = useTranslations('settings.members.invite');
  const locale = useLocale();
  const { companySettings } = useCompany();

  const [codes, setCodes] = useState<{ adminCode: string | null; staffCode: string | null } | null>(null);
  const [role, setRole] = useState<Role>('staff');
  const [copied, setCopied] = useState(false);

  const companyName = useMemo(() => {
    const row = (companySettings ?? {}) as Record<string, unknown>;
    const name = row['Naziv Podjetja'] ?? row['Ime podjetja'];
    return typeof name === 'string' ? name : '';
  }, [companySettings]);

  useEffect(() => {
    if (!open) return;
    setCopied(false);
    fetch('/api/company/join-codes')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setCodes(data ? { adminCode: data.adminCode ?? null, staffCode: data.staffCode ?? null } : null))
      .catch(() => setCodes(null));
    // Joining creates the person's staff card automatically (n8n join-company),
    // so there is no card to pick here yet — linking to an existing card would
    // leave a duplicate until join-company accepts a person_id.
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const seatsFull = maxSeats !== null && usedSeats >= maxSeats;
  const code = role === 'admin' ? codes?.adminCode : codes?.staffCode;
  const url =
    code && typeof window !== 'undefined'
      ? buildInviteUrl(window.location.origin, locale, {
          code,
          companyName: companyName || undefined,
        })
      : '';
  const message = t('message', { company: companyName || 'Jedro+', url });

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — the field is selectable
    }
  };

  const shareClass =
    'flex h-10 items-center justify-center gap-2 rounded-[10px] border border-gray-200 bg-white text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 active:bg-gray-100';

  // Portal to <body> so the fixed sidebar can't sit on top of the dialog.
  return createPortal(
    <div className={sheet.backdrop.replace('z-50', 'z-[120]')} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-title"
        className={`${sheet.panel} sm:max-w-lg`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={sheet.header}>
          <div className={sheet.grabber} aria-hidden="true" />
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="invite-title" className={sheet.title}>{t('title')}</h2>
              <p className={sheet.subtitle}>{t('subtitle')}</p>
            </div>
            <button type="button" onClick={onClose} aria-label={t('close')} className={sheet.close}>
              <X className="h-5 w-5" weight="regular" />
            </button>
          </div>
        </div>

        <div className={sheet.body}>
        {maxSeats !== null && (
          <p className="tnum px-1 text-[13px] text-gray-500">
            {t('seats', { used: usedSeats, total: maxSeats })}
          </p>
        )}

        {seatsFull ? (
          <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            <p className="flex items-center gap-2 font-semibold">
              <Warning size={16} weight="regular" aria-hidden="true" />
              {t('fullTitle')}
            </p>
            <p className="mt-1 leading-6">{isFree ? t('fullBodyFree') : t('fullBodyPaid')}</p>
            <p className="mt-1 text-xs text-amber-800">{t('staffStillFree')}</p>
            <Link
              href={isFree ? '/nastavitve/paketi#razpolozljivi-paketi' : '/nastavitve/addoni'}
              className="mt-3 inline-flex rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
            >
              {isFree ? t('upgrade') : t('addSeats')}
            </Link>
          </div>
        ) : (
          <>
            {/* Role */}
            <fieldset className={sheet.group}>
              <legend className="float-left mb-2 w-full text-[11px] font-semibold uppercase tracking-wider text-gray-500">{t('roleLabel')}</legend>
              <div className="clear-both grid gap-2 sm:grid-cols-2">
                {(['staff', 'admin'] as Role[]).map((r) => {
                  const disabled = r === 'admin' && !codes?.adminCode;
                  return (
                    <label
                      key={r}
                      htmlFor={`invite-role-${r}`}
                      className={`cursor-pointer rounded-[10px] border p-3 transition-colors ${
                        role === r ? 'border-violet-400 bg-violet-50/50 ring-1 ring-violet-200' : 'border-gray-200 hover:border-gray-300'
                      } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                    >
                      <input
                        id={`invite-role-${r}`}
                        type="radio"
                        name="invite-role"
                        value={r}
                        checked={role === r}
                        disabled={disabled}
                        onChange={() => setRole(r)}
                        className="sr-only"
                      />
                      <span className="block text-sm font-semibold text-gray-900">{t(`roles.${r}.title`)}</span>
                      <span className="mt-0.5 block text-xs leading-5 text-gray-500">{t(`roles.${r}.body`)}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {/* Link + share */}
            <div className={sheet.group}>
              <label htmlFor="invite-link" className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                {t('linkLabel')}
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id="invite-link"
                  readOnly
                  value={url || t('loading')}
                  onFocus={(e) => e.currentTarget.select()}
                  className="h-10 min-w-0 flex-1 rounded-[10px] border border-gray-200 bg-gray-50 px-3 text-xs text-gray-700"
                />
                <button
                  type="button"
                  onClick={copy}
                  disabled={!url}
                  className="inline-flex h-10 items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-violet-500 to-cyan-500 px-3.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {copied ? <Check size={16} weight="bold" /> : <Copy size={16} />}
                  {copied ? t('copied') : t('copy')}
                </button>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <a
                  href={url ? `mailto:?subject=${encodeURIComponent(t('emailSubject', { company: companyName || 'Jedro+' }))}&body=${encodeURIComponent(message)}` : undefined}
                  className={shareClass}
                  aria-disabled={!url}
                >
                  <EnvelopeSimple size={16} /> {t('viaEmail')}
                </a>
                <a
                  href={url ? `https://wa.me/?text=${encodeURIComponent(message)}` : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={shareClass}
                  aria-disabled={!url}
                >
                  <WhatsappLogo size={16} /> WhatsApp
                </a>
                <a href={url ? `sms:?&body=${encodeURIComponent(message)}` : undefined} className={shareClass} aria-disabled={!url}>
                  <ChatText size={16} /> SMS
                </a>
              </div>
              <p className="mt-3 text-xs leading-5 text-gray-500">{t('privacyNote')}</p>
            </div>
          </>
        )}
        </div>
      </div>
    </div>,
    document.body
  );
}
