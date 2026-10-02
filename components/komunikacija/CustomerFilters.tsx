'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FunnelSimple, CaretDown, CalendarBlank } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';

const SERVICE_OPTIONS_DATA = [
  'Striženje',
  'Barvanje',
  'Manikura',
  'Pedikura',
  'Masaža',
  'Kozmetika',
];

interface CustomerFiltersProps {
  activeFilter: string;
  onFilterChange: (filterId: string) => void;
  onServiceFilterChange: (service: string) => void;
  selectedService: string;
  /** Koliko strank pade v posamezno skupino — prikazano že pred klikom. */
  counts?: Record<string, number>;
}

export default function CustomerFilters({
  activeFilter,
  onFilterChange,
  onServiceFilterChange,
  selectedService,
  counts,
}: CustomerFiltersProps) {
  const t = useTranslations('communication');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const quickFilters = [
    { id: 'all', label: t('filters.all') },
    { id: 'today', label: t('filters.today') },
    { id: 'tomorrow', label: t('filters.tomorrow') },
    { id: 'this-week', label: t('filters.thisWeek') },
    { id: 'this-month', label: t('filters.thisMonth') },
  ];

  const serviceOptions = [t('filters.allServices'), ...SERVICE_OPTIONS_DATA];

  return (
    <div className="space-y-3">
      {/* Skupine s številom — koliko strank dobiš, veš še preden klikneš. */}
      <div className="flex flex-wrap gap-1.5">
        {quickFilters.map((filter) => {
          const isActive = activeFilter === filter.id;
          const count = counts?.[filter.id];
          return (
            <button
              key={filter.id}
              type="button"
              onClick={() => onFilterChange(filter.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
                isActive
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filter.label}
              {typeof count === 'number' && (
                <span className={`tnum ${isActive ? 'text-white/60' : 'text-gray-400'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Advanced filters toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-1.5 text-[13px] text-gray-500 transition-colors hover:text-gray-900"
      >
        <FunnelSimple className="h-4 w-4" weight="regular" />
        <span>{t('filters.advanced')}</span>
        <CaretDown
          className={`h-3 w-3 transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`}
          weight="bold"
        />
      </button>

      {/* Advanced filters panel */}
      <AnimatePresence>
        {showAdvanced && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 gap-3 rounded-xl bg-gray-50 p-4">
              {/* Service filter */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-500">
                  {t('filters.serviceLabel')}
                </label>
                <div className="relative">
                  <select
                    value={selectedService}
                    onChange={(e) => onServiceFilterChange(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 py-2 pr-8 text-sm text-gray-900 transition-colors focus:border-[#7C78FA] focus:outline-none focus:ring-[3px] focus:ring-[#7C78FA]/25"
                  >
                    {serviceOptions.map((service) => (
                      <option key={service} value={service}>
                        {service}
                      </option>
                    ))}
                  </select>
                  <CaretDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" weight="bold" />
                </div>
              </div>

              {/* Date range */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-500">
                  {t('filters.dateRangeLabel')}
                </label>
                <div className="relative">
                  <CalendarBlank className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" weight="regular" />
                  <input
                    type="date"
                    className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 transition-colors focus:border-[#7C78FA] focus:outline-none focus:ring-[3px] focus:ring-[#7C78FA]/25"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
