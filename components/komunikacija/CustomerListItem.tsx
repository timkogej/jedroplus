'use client';

import { motion } from 'motion/react';
import { Check } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  nextAppointment: string | null;
  lastVisit: string;
  tags: string[];
  appointmentDates?: string[];
  optedOut?: boolean;
}

interface CustomerListItemProps {
  customer: Customer;
  selected: boolean;
  onToggle: (id: string) => void;
}

/**
 * Ena vrstica v seznamu prejemnikov.
 *
 * Vrstica nima svoje obrobe — seznam je ena kartica, vrstice pa ločijo lasne
 * črte, kot v Applovih skupinskih seznamih. Izbrana vrstica je samo rahlo
 * obarvana, kljukica pa stoji levo, kot v iOS načinu urejanja.
 */
export default function CustomerListItem({
  customer,
  selected,
  onToggle,
}: CustomerListItemProps) {
  const t = useTranslations('communication');
  const initials = customer.name
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      onClick={() => onToggle(customer.id)}
      aria-disabled={customer.optedOut || undefined}
      title={customer.optedOut ? t('customerList.optedOutHint') : undefined}
      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
        customer.optedOut
          ? 'cursor-not-allowed opacity-50'
          : selected ? 'bg-violet-50/60' : 'hover:bg-gray-50'
      }`}
    >
      <span
        className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full transition-colors ${
          selected ? 'bg-[#7C78FA]' : 'border border-gray-300 bg-white'
        }`}
      >
        {selected && (
          <motion.span initial={{ scale: 0.6 }} animate={{ scale: 1 }}>
            <Check className="h-3 w-3 text-white" weight="bold" />
          </motion.span>
        )}
      </span>

      {/* Gradientne začetnice — brez kroga okoli */}
      <span
        className="w-7 flex-shrink-0 text-sm font-bold"
        style={{
          backgroundImage: 'linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        {initials}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-gray-900">{customer.name}</span>
        <span className="block truncate text-[13px] text-gray-500">{customer.email}</span>
      </span>

      {customer.optedOut && (
        <span className="flex-shrink-0 text-[13px] text-gray-400">
          {t('customerList.optedOut')}
        </span>
      )}
    </button>
  );
}
