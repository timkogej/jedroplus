'use client';

import { memo, useState } from 'react';
import { CaretDown } from '@phosphor-icons/react';
import { Select, SelectOption } from '@/components/ui/animated-select';
import {
  COMMUNICATION_LANGUAGES,
  getCommunicationLanguageOption,
  normalizeCommunicationLanguage,
  type CommunicationLanguageCode,
} from '@/lib/communicationLanguage';

interface CommunicationLanguageControlProps {
  value: CommunicationLanguageCode;
  onChange: (value: CommunicationLanguageCode) => void;
  label?: string;
  changeLabel?: string;
  compact?: boolean;
  variant?: 'default' | 'divider';
  className?: string;
}

function CommunicationLanguageControl({
  value,
  onChange,
  label,
  changeLabel = 'Spremeni',
  compact = false,
  variant = 'default',
  className = '',
}: CommunicationLanguageControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const option = getCommunicationLanguageOption(value);

  if (variant === 'divider') {
    return (
      <div className={className}>
        {!isOpen ? (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            title={label ? `${label}: ${option.label}` : option.label}
            className="flex w-full items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 text-left transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          >
            <span className="text-sm font-medium text-gray-900">{label ?? 'Jezik'}</span>
            <span className="flex items-center gap-2 text-sm text-gray-600">
              <span className="text-base leading-none" aria-hidden="true">{option.flag}</span>
              {option.label}
              <CaretDown className="h-3.5 w-3.5 text-gray-400" weight="bold" aria-hidden="true" />
            </span>
          </button>
        ) : (
          <Select
            value={option.value}
            setValue={(nextValue) => {
              onChange(normalizeCommunicationLanguage(nextValue));
              setIsOpen(false);
            }}
            className="[&>button]:rounded-xl [&>button]:focus:ring-gray-900/10"
          >
            {COMMUNICATION_LANGUAGES.map((language) => (
              <SelectOption key={language.value} value={language.value} description={language.label}>
                <span className="mr-2">{language.flag}</span>
                {language.code}
              </SelectOption>
            ))}
          </Select>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      {label && (
        <label className={`${compact ? 'sr-only' : 'mb-1.5 block'} text-xs font-semibold uppercase tracking-wider text-gray-500`}>
          {label}
        </label>
      )}

      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`flex w-full items-center justify-between gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 text-left transition-colors hover:border-gray-200 hover:bg-white ${
            compact ? 'min-h-[50px] sm:min-w-[132px]' : ''
          }`}
          title={label}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="text-base leading-none">{option.flag}</span>
            <span className="text-xs font-semibold text-gray-700">{option.code}</span>
            {!compact && (
              <span className="truncate text-sm text-gray-600">{option.label}</span>
            )}
          </span>
          {!compact && (
            <span className="text-xs font-semibold text-gray-500 underline underline-offset-2">
              {changeLabel}
            </span>
          )}
        </button>
      ) : (
        <Select
          value={option.value}
          setValue={(nextValue) => {
            onChange(normalizeCommunicationLanguage(nextValue));
            setIsOpen(false);
          }}
          className="[&>button]:rounded-xl [&>button]:focus:ring-gray-900/10"
        >
          {COMMUNICATION_LANGUAGES.map((language) => (
            <SelectOption key={language.value} value={language.value} description={language.label}>
              <span className="mr-2">{language.flag}</span>
              {language.code}
            </SelectOption>
          ))}
        </Select>
      )}
    </div>
  );
}

export default memo(CommunicationLanguageControl);
