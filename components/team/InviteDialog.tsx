'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Check, Copy, EnvelopeSimple, WhatsappLogo, ChatText, X, Warning } from '@phosphor-icons/react';
import { useCompany } from '@/app/company-context';
import { fetchEmployees } from '@/lib/supabase/employees';
import { buildInviteUrl } from '@/lib/team/invite';

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
 * "Invite to team": builds a personal link that carries the join code (and
 * optionally the staff card to link), ready to send by email, WhatsApp or SMS.
 * No codes to read out, and the invitee lands linked to their own schedule.
 */
export default function InviteDialog({ open, onClose, usedSeats, maxSeats, isFree }: InviteDialogProps) {
  const t = useTranslations('settings.members.invite');
  const locale = useLocale();
  const { companyId, companySettings } = useCompany();

  const [codes, setCodes] = useState<{ adminCode: string | null; staffCode: string | null } | null>(null);
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [role, setRole] = useState<Role>('staff');
  const [personId, setPersonId] = useState('');
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
    if (companyId) {
      fetchEmployees(companyId).then((res) => {
        const rows = (res.data ?? []) as { id: string | number; ime?: string; priimek?: string }[];
        setPeople(
          rows
            .map((r) => ({ id: String(r.id), name: `${r.ime ?? ''} ${r.priimek ?? ''}`.trim() }))
            .filter((p) => p.name)
        );
      });
    }
  }, [open, companyId]);

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
          personId: role === 'staff' && personId ? personId : undefined,
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
    'flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="invite-title" className="text-lg font-semibold text-gray-900">{t('title')}</h2>
            <p className="mt-1 text-sm text-gray-500">{t('subtitle')}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t('close')} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
            <X size={16} weight="bold" />
          </button>
        </div>

        <p className="mt-4 text-xs text-gray-500">
          {maxSeats !== null ? t('seats', { used: usedSeats, total: maxSeats }) : null}
        </p>

        {seatsFull ? (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="flex items-center gap-2 font-semibold">
              <Warning size={16} weight="fill" aria-hidden="true" />
              {t('fullTitle')}
            </p>
            <p className="mt-1 leading-6">{isFree ? t('fullBodyFree') : t('fullBodyPaid')}</p>
            <p className="mt-1 text-xs text-amber-800">{t('staffStillFree')}</p>
            <Link
              href={isFree ? '/nastavitve/paketi#razpolozljivi-paketi' : '/nastavitve/addoni'}
              className="mt-3 inline-flex rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
            >
              {isFree ? t('upgrade') : t('addSeats')}
            </Link>
          </div>
        ) : (
          <div className="mt-4 space-y-5">
            {/* Role */}
            <fieldset>
              <legend className="text-sm font-semibold text-gray-900">{t('roleLabel')}</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {(['staff', 'admin'] as Role[]).map((r) => {
                  const disabled = r === 'admin' && !codes?.adminCode;
                  return (
                    <label
                      key={r}
                      htmlFor={`invite-role-${r}`}
                      className={`cursor-pointer rounded-xl border-2 p-3 ${
                        role === r ? 'border-violet-400 bg-violet-50/50' : 'border-gray-100'
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

            {/* Staff card */}
            {role === 'staff' && (
              <div>
                <label htmlFor="invite-person" className="text-sm font-semibold text-gray-900">
                  {t('personLabel')}
                </label>
                <p className="mt-0.5 text-xs text-gray-500">{t('personHint')}</p>
                <select
                  id="invite-person"
                  value={personId}
                  onChange={(e) => setPersonId(e.target.value)}
                  className="mt-2 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-400"
                >
                  <option value="">{t('personNone')}</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Link + share */}
            <div>
              <label htmlFor="invite-link" className="text-sm font-semibold text-gray-900">
                {t('linkLabel')}
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id="invite-link"
                  readOnly
                  value={url || t('loading')}
                  onFocus={(e) => e.currentTarget.select()}
                  className="h-10 min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 text-xs text-gray-700"
                />
                <button
                  type="button"
                  onClick={copy}
                  disabled={!url}
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-gray-900 px-3.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
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
          </div>
        )}
      </div>
    </div>
  );
}
