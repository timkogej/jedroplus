'use client';

import { useState } from 'react';
import { Plus, Translate } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { TemplateEditor } from '@/components/reminders/TemplateEditor';
import { MessagePreview } from '@/components/reminders/MessagePreview';

export interface EmailTemplateValue {
  subject: string;
  body: string;
}

interface EmailConfirmationTemplateProps {
  mode: 'ai' | 'manual';
  onModeChange: (mode: 'ai' | 'manual') => void;
  value: EmailTemplateValue;
  onChange: (value: EmailTemplateValue) => void;
  english: EmailTemplateValue;
  onEnglishChange: (value: EmailTemplateValue) => void;
  /** Hide the English version when the company already sends in English. */
  showEnglish: boolean;
  companyName?: string;
}

const ENGLISH_DEFAULT: EmailTemplateValue = {
  subject: 'Your appointment at {{ime_podjetja}}',
  body:
    'Hi {{ime}},\n\nyour appointment for {{storitev}} is booked for {{datum}} at {{cas}}.\n\n' +
    'If you need to reschedule or cancel, you can do it here: {{povezava_prenarocanje}}\n\n' +
    'See you soon,\n{{ime_podjetja}}\n{{telefon_podjetja}}',
};

/** Subject (one line) and body (several lines) of one language. */
function SubjectAndBody({
  value,
  onChange,
  companyName,
  subjectPlaceholder,
  bodyPlaceholder,
}: {
  value: EmailTemplateValue;
  onChange: (value: EmailTemplateValue) => void;
  companyName?: string;
  subjectPlaceholder: string;
  bodyPlaceholder: string;
}) {
  const t = useTranslations('reservations.modal.confirmations.email');
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-gray-700">{t('subjectLabel')}</p>
        <TemplateEditor
          value={value.subject}
          onChange={(subject) => onChange({ ...value, subject })}
          maxLength={0}
          rows={1}
          placeholder={subjectPlaceholder}
        />
      </div>
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-gray-700">{t('bodyLabel')}</p>
        <TemplateEditor
          value={value.body}
          onChange={(body) => onChange({ ...value, body })}
          maxLength={0}
          rows={7}
          multiline
          placeholder={bodyPlaceholder}
        />
        <p className="text-xs text-gray-400">{t('bodyHint')}</p>
      </div>
      <MessagePreview template={value.body} subject={value.subject} companyName={companyName} sms={false} />
    </div>
  );
}

/**
 * Who writes the booking-confirmation email: AI (as before) or the company's
 * own template. Applies to manual and online bookings alike (n8n node
 * "Email predloga - potrdilo" in both workflows).
 */
export function EmailConfirmationTemplate({
  mode,
  onModeChange,
  value,
  onChange,
  english,
  onEnglishChange,
  showEnglish,
  companyName,
}: EmailConfirmationTemplateProps) {
  const t = useTranslations('reservations.modal.confirmations');
  const tEmail = useTranslations('reservations.modal.confirmations.email');
  const tEnglish = useTranslations('reminders.modal.englishVariant');
  const [englishOpen, setEnglishOpen] = useState(false);
  const englishShown = englishOpen || english.subject.trim() !== '' || english.body.trim() !== '';

  const chooseMode = (next: 'ai' | 'manual') => {
    // A blank box is hard to start from: offer a ready text the first time.
    if (next === 'manual' && !value.subject.trim() && !value.body.trim()) {
      onChange({ subject: String(tEmail.raw('defaultSubject')), body: String(tEmail.raw('defaultBody')) });
    }
    onModeChange(next);
  };

  return (
    <div className="mt-3 space-y-4 rounded-[10px] bg-gray-50 p-4">
      <div>
        <div className="text-sm font-semibold text-gray-900">{tEmail('title')}</div>
        <p className="mt-0.5 text-xs text-gray-500">{tEmail('appliesTo')}</p>
      </div>

      <div className="grid grid-cols-2 gap-0.5 rounded-[9px] bg-gray-100 p-0.5">
        {([
          { value: 'ai' as const, label: t('modeAI') },
          { value: 'manual' as const, label: t('modeManual') },
        ]).map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => chooseMode(opt.value)}
            className={`rounded-[7px] px-3 py-1.5 text-sm font-medium transition-all ${
              mode === opt.value
                ? 'bg-white text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.1)]'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {mode === 'ai' ? (
        <p className="text-xs text-gray-500">{tEmail('aiHint')}</p>
      ) : (
        <div className="space-y-4">
          <SubjectAndBody
            value={value}
            onChange={onChange}
            companyName={companyName}
            subjectPlaceholder={String(tEmail.raw('defaultSubject'))}
            bodyPlaceholder={String(tEmail.raw('bodyPlaceholder'))}
          />
          {!value.body.trim() && <p className="text-xs text-amber-700">{tEmail('emptyBodyWarning')}</p>}

          {showEnglish &&
            (englishShown ? (
              <div className="space-y-3 rounded-xl border border-dashed border-gray-200 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-800">
                    <Translate className="h-4 w-4 text-gray-500" />
                    {tEnglish('title')}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onEnglishChange({ subject: '', body: '' });
                      setEnglishOpen(false);
                    }}
                    className="text-xs text-gray-500 hover:text-red-600"
                  >
                    {tEnglish('remove')}
                  </button>
                </div>
                <p className="text-xs text-gray-500">{tEnglish('hint')}</p>
                <SubjectAndBody
                  value={english}
                  onChange={onEnglishChange}
                  companyName={companyName}
                  subjectPlaceholder={ENGLISH_DEFAULT.subject}
                  bodyPlaceholder="Hi {{ime}}, your appointment is booked for {{datum}} at {{cas}}."
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (!english.subject.trim() && !english.body.trim()) onEnglishChange(ENGLISH_DEFAULT);
                  setEnglishOpen(true);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-700"
              >
                <Plus className="h-3.5 w-3.5" weight="bold" />
                {tEnglish('add')}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
