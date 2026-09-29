'use client';

import { memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users } from '@phosphor-icons/react';
import EmployeeCard, { EmployeeCardSkeleton } from './EmployeeCard';
import type { Employee } from '@/types/employees';

interface EmployeeGridProps {
  employees: Employee[];
  isLoading: boolean;
  onEdit: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
  onToggleActive: (employee: Employee) => void;
  onSettings?: (employee: Employee) => void;
  onConnect?: (employee: Employee) => void;
  showConnectButton?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  connectedPersonId?: string | null;
}

function EmployeeGrid({
  employees,
  isLoading,
  onEdit,
  onDelete,
  onToggleActive,
  onSettings,
  onConnect,
  showConnectButton = false,
  canEdit = true,
  canDelete = true,
  connectedPersonId,
}: EmployeeGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <EmployeeCardSkeleton key={index} index={index} />
        ))}
      </div>
    );
  }

  if (employees.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center rounded-xl border border-gray-100 bg-white p-12"
      >
        <Users className="mb-3 h-7 w-7 text-gray-300" weight="regular" />
        <h3 className="text-base font-semibold text-gray-900">
          Ni zaposlenih
        </h3>
        <p className="mt-1 text-center text-sm text-gray-500">
          Dodajte prvega zaposlenega s klikom na gumb &quot;Dodaj zaposlenega&quot;
        </p>
      </motion.div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <AnimatePresence mode="popLayout">
        {employees.map((employee, index) => (
          <EmployeeCard
            key={employee.id}
            employee={employee}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggleActive={onToggleActive}
            onSettings={onSettings}
            onConnect={onConnect}
            showConnectButton={showConnectButton && !employee.auth_user_id}
            index={index}
            canEdit={canEdit}
            canDelete={canDelete}
            isConnected={!!connectedPersonId && employee.id === connectedPersonId}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

export default memo(EmployeeGrid);
