'use client';

import { useState } from 'react';
import { Plus, Translate } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { TemplateEditor } from './TemplateEditor';
import { MessagePreview } from './MessagePreview';

interface EnglishVariantProps {
  value: string;
  onChange: (value: string) => void;
  /** 0 = no limit (email). */
  maxLength: number;
  sms?: boolean;
  placeholder?: string;
  varLengths?: Record<string, number>;
  companyName?: string;
}

/**
 * Optional English version of a custom template, sent to clients whose
 * language isn't the company's. Collapsed until the owner adds it.
 */
export function EnglishVariant({
  value,
  onChange,
  maxLength,
  sms = true,
  placeholder,
  varLengths,
  companyName,
}: EnglishVariantProps) {
  const t = useTranslations('reminders.modal.englishVariant');
  const [open, setOpen] = useState(false);
  const shown = open || value.trim() !== '';

  if (!shown) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-700"
      >
        <Plus className="h-3.5 w-3.5" weight="bold" />
        {t('add')}
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-dashed border-gray-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-800">
          <Translate className="h-4 w-4 text-gray-500" />
          {t('title')}
        </span>
        <button
          type="button"
          onClick={() => {
            onChange('');
            setOpen(false);
          }}
          className="text-xs text-gray-500 hover:text-red-600"
        >
          {t('remove')}
        </button>
      </div>
      <p className="text-xs text-gray-500">{t('hint')}</p>
      <TemplateEditor
        value={value}
        onChange={onChange}
        maxLength={maxLength}
        rows={4}
        placeholder={placeholder ?? String(t.raw('placeholder'))}
        varLengths={varLengths}
      />
      <MessagePreview template={value} companyName={companyName} sms={sms} />
    </div>
  );
}
