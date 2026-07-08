import { getCommunicationLanguageOption } from '@/lib/communicationLanguage';

interface CommunicationLanguageFlagProps {
  value?: unknown;
  className?: string;
  showCode?: boolean;
}

export default function CommunicationLanguageFlag({
  value,
  className = '',
  showCode = false,
}: CommunicationLanguageFlagProps) {
  const option = getCommunicationLanguageOption(value);

  return (
    <span
      className={`inline-flex h-7 flex-shrink-0 items-center gap-1 rounded-full border border-white/20 bg-white/90 px-2 text-sm font-semibold leading-none text-gray-700 shadow-sm ${className}`}
      title={`${option.label} (${option.code})`}
      aria-label={`Jezik komunikacije: ${option.label}`}
    >
      <span className="text-base leading-none">{option.flag}</span>
      {showCode && <span className="text-[10px] leading-none">{option.code}</span>}
    </span>
  );
}
