'use client';

import { memo } from 'react';
import { Phone, Envelope } from '@phosphor-icons/react';

interface ClientInfoCardProps {
  icon: 'phone' | 'email';
  label: string;
  value: string;
}

function ClientInfoCard({ icon, label, value }: ClientInfoCardProps) {
  if (!value) return null;

  const IconComponent = icon === 'phone' ? Phone : Envelope;

  return (
    <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white shadow-sm">
        <IconComponent className="h-4 w-4 text-gray-500" weight="regular" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
          {label}
        </p>
        <p className="truncate text-sm font-medium text-[#1A1F36]">{value}</p>
      </div>
    </div>
  );
}

export default memo(ClientInfoCard);
