'use client';

import { motion } from 'motion/react';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  nextAppointment: string | null;
  lastVisit: string;
  tags: string[];
  appointmentDates?: string[];
}

interface CustomerListItemProps {
  customer: Customer;
  selected: boolean;
  onToggle: (id: string) => void;
  index: number;
}

export default function CustomerListItem({
  customer,
  selected,
  onToggle,
  index,
}: CustomerListItemProps) {
  const initials = customer.name
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.2 }}
      onClick={() => onToggle(customer.id)}
      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200 ${
        selected
          ? 'bg-violet-50/50 border-violet-200 shadow-sm'
          : 'bg-white border-gray-100 hover:bg-gray-50 hover:border-gray-200'
      }`}
    >
      {/* Checkbox */}
      <div className="flex-shrink-0">
        <div
          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
            selected
              ? 'bg-violet-500 border-transparent'
              : 'border-gray-300 bg-white'
          }`}
        >
          {selected && (
            <motion.svg
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-3 h-3 text-white"
              viewBox="0 0 12 12"
              fill="none"
            >
              <path
                d="M2.5 6L5 8.5L9.5 3.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </motion.svg>
          )}
        </div>
      </div>

      {/* Avatar - gradient text initials, no circle */}
      <div className="flex-shrink-0 w-8 flex items-center justify-center">
        <span
          className="text-sm font-bold"
          style={{
            background: 'linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {initials}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#1A1F36] truncate">{customer.name}</p>
        <p className="text-xs text-gray-400 truncate">{customer.email}</p>
      </div>
    </motion.div>
  );
}
