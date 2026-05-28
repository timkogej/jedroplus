'use client';

import { LockSimple } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';

interface RoleAccessGateProps {
  message?: string;
}

export default function RoleAccessGate({
  message,
}: RoleAccessGateProps) {
  const t = useTranslations('billing');

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
        <LockSimple className="w-8 h-8 text-gray-400" weight="fill" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">{t('roleAccessGate.title')}</h2>
        <p className="text-sm text-gray-500 max-w-sm">{message ?? t('roleAccessGate.defaultMessage')}</p>
      </div>
    </div>
  );
}
