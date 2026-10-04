'use client';

import { intlLocale } from '@/lib/format';
import { useLocale, useTranslations } from 'next-intl';
import { migrateTemplate } from './TemplateEditor';

// GSM 03.38 basic alphabet + extension table. Anything outside it (č, š, ž,
// emoji…) forces UCS-2 encoding, where one SMS holds 70 characters, not 160.
const GSM_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM_EXTENDED = '^{}\\[~]|€';

function smsStats(text: string) {
  const chars = Array.from(text);
  const nonGsm = chars.filter((c) => !GSM_BASIC.includes(c) && !GSM_EXTENDED.includes(c));
  const unicode = nonGsm.length > 0;
  // Extension characters take two slots in GSM-7.
  const length = unicode
    ? chars.length
    : chars.reduce((n, c) => n + (GSM_EXTENDED.includes(c) ? 2 : 1), 0);
  const single = unicode ? 70 : 160;
  const multi = unicode ? 67 : 153;
  const parts = length === 0 ? 0 : length <= single ? 1 : Math.ceil(length / multi);
  return { length, parts, unicode, offending: Array.from(new Set(nonGsm)).slice(0, 6) };
}

interface MessagePreviewProps {
  template: string;
  companyName?: string;
  /** Show SMS length/parts and the special-character warning. */
  sms?: boolean;
}

/**
 * Renders a reminder template the way a client would receive it, with sample
 * data in place of {{variables}}, as a message bubble.
 */
export function MessagePreview({ template, companyName, sms = true }: MessagePreviewProps) {
  const t = useTranslations('reminders.preview');
  const locale = useLocale();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const sample: Record<string, string> = {
    '{{ime}}': t('sample.firstName'),
    '{{priimek}}': t('sample.lastName'),
    '{{datum}}': tomorrow.toLocaleDateString(intlLocale(locale), { day: 'numeric', month: 'numeric' }),
    '{{cas}}': '10:00',
    '{{storitev}}': t('sample.service'),
    '{{ime_izvajalca}}': t('sample.staff'),
    '{{ime_podjetja}}': companyName?.trim() || t('sample.company'),
    '{{naslov}}': t('sample.address'),
    '{{telefon_podjetja}}': '040 123 456',
    '{{email_podjetja}}': 'info@salon.si',
    '{{leto}}': String(tomorrow.getFullYear()),
    '{{povezava_prenarocanje}}': 'jedro.link/abc',
  };

  const migrated = migrateTemplate(template || '');
  const unknown = Array.from(new Set(migrated.match(/\{\{[^}]*\}\}/g) ?? [])).filter((token) => !(token in sample));
  const text = migrated.replace(/\{\{[a-z_]+\}\}/g, (token) => sample[token] ?? token);
  if (!text.trim()) return null;
  const stats = smsStats(text);

  return (
    <div className="space-y-2" aria-label={t('label')}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">{t('label')}</p>
      <div className="rounded-2xl bg-gray-100 p-3">
        <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-sm leading-6 text-gray-900 shadow-sm">
          <p className="whitespace-pre-wrap break-words">{text}</p>
        </div>
      </div>
      {unknown.length > 0 && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
          {t('unknownVars', { tokens: unknown.join(', ') })}
        </p>
      )}
      {sms && (
        <div className="space-y-1">
          <p className="text-xs text-gray-500 tabular-nums">
            {t('stats', { length: stats.length, parts: stats.parts })}
          </p>
          {stats.unicode ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
              {t('unicodeWarning', { chars: stats.offending.join(' ') })}
            </p>
          ) : (
            <p className="text-xs text-gray-400">{t('gsmHint')}</p>
          )}
        </div>
      )}
    </div>
  );
}
