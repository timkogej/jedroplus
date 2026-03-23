'use client';

import { LockSimple } from '@phosphor-icons/react';

interface RoleAccessGateProps {
  message?: string;
}

/**
 * Full-page placeholder shown when the user's role/permissions
 * don't allow access to a particular route or feature.
 */
export default function RoleAccessGate({
  message = 'Nimate dostopa do te strani. Obrnite se na lastnika podjetja.',
}: RoleAccessGateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
        <LockSimple className="w-8 h-8 text-gray-400" weight="fill" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Dostop omejen</h2>
        <p className="text-sm text-gray-500 max-w-sm">{message}</p>
      </div>
    </div>
  );
}
