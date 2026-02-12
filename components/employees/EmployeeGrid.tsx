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
}

function EmployeeGrid({
  employees,
  isLoading,
  onEdit,
  onDelete,
  onToggleActive,
  onSettings,
}: EmployeeGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
        className="flex flex-col items-center justify-center rounded-2xl bg-white p-12 shadow-sm ring-1 ring-gray-100"
      >
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-purple-100 to-pink-100">
          <Users className="h-10 w-10 text-purple-500" weight="duotone" />
        </div>
        <h3 className="mt-6 text-lg font-semibold text-[#1A1F36]">
          Ni zaposlenih
        </h3>
        <p className="mt-2 text-center text-sm text-gray-500">
          Dodajte prvega zaposlenega s klikom na gumb &quot;Dodaj zaposlenega&quot;
        </p>
      </motion.div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <AnimatePresence mode="popLayout">
        {employees.map((employee, index) => (
          <EmployeeCard
            key={employee.id}
            employee={employee}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggleActive={onToggleActive}
            onSettings={onSettings}
            index={index}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

export default memo(EmployeeGrid);
