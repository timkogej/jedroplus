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
    <div className="flex items-center gap-2.5 rounded-[10px] bg-gray-50 px-3 py-2.5">
      {/* Ikona brez kvadratka okoli */}
      <IconComponent className="h-4 w-4 flex-shrink-0 text-gray-400" weight="regular" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
          {label}
        </p>
        <p className="truncate text-sm font-medium text-gray-900">{value}</p>
      </div>
    </div>
  );
}

export default memo(ClientInfoCard);
