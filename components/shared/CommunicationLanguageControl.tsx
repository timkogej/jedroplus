'use client';

import { memo, useState } from 'react';
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
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-100" />
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              title={label ? `${label}: ${option.label}` : option.label}
              aria-label={label ? `${label}: ${option.label}` : option.label}
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-sm leading-none shadow-sm transition-colors hover:border-gray-300 hover:bg-gray-50"
            >
              {option.flag}
            </button>
            <div className="h-px flex-1 bg-gray-100" />
          </div>
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
