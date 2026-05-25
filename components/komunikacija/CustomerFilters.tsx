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
}

export default function CustomerFilters({
  activeFilter,
  onFilterChange,
  onServiceFilterChange,
  selectedService,
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
      {/* Section label */}
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('filters.sectionLabel')}</p>

      {/* Quick filter pills */}
      <div className="flex flex-wrap gap-2">
        {quickFilters.map((filter) => {
          const isActive = activeFilter === filter.id;
          return (
            <motion.button
              key={filter.id}
              type="button"
              onClick={() => onFilterChange(filter.id)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-violet-500 to-cyan-500 text-white shadow-md shadow-violet-500/20'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              {filter.label}
            </motion.button>
          );
        })}
      </div>

      {/* Advanced filters toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <FunnelSimple className="h-4 w-4" weight="bold" />
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
              {/* Service filter */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 block">
                  {t('filters.serviceLabel')}
                </label>
                <div className="relative">
                  <select
                    value={selectedService}
                    onChange={(e) => onServiceFilterChange(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#1A1F36] focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 pr-8"
                  >
                    {serviceOptions.map((service) => (
                      <option key={service} value={service}>
                        {service}
                      </option>
                    ))}
                  </select>
                  <CaretDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" weight="bold" />
                </div>
              </div>

              {/* Date range */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 block">
                  {t('filters.dateRangeLabel')}
                </label>
                <div className="relative">
                  <CalendarBlank className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" weight="regular" />
                  <input
                    type="date"
                    className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 py-2 text-sm text-[#1A1F36] focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
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
