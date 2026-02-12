'use client';

import { memo } from 'react';

interface StatusBadgeProps {
  enabled: boolean;
  enabledText?: string;
  disabledText?: string;
}

function StatusBadge({
  enabled,
  enabledText = 'Omogočeno',
  disabledText = 'Onemogočeno'
}: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold
                  ${enabled
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-gray-100 text-gray-600'
                  }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-emerald-500' : 'bg-gray-400'}`} />
      {enabled ? enabledText : disabledText}
    </span>
  );
}

export default memo(StatusBadge);
