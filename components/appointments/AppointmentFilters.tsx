'use client';

import { memo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MagnifyingGlass, X, Funnel, CalendarBlank } from '@phosphor-icons/react';
import { Select, SelectOption } from '@/components/ui/animated-select';
import type { Storitev, Zaposleni } from '@/types/appointments';
import type { AppointmentStatus } from './StatusBadge';
import { getStatusConfig } from './StatusBadge';

export interface FilterState {
  search: string;
  status: AppointmentStatus | 'all';
  employeeId: string | null;
  serviceId: string | null;
  dateFrom: string;
  dateTo: string;
}

interface AppointmentFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  employees: Zaposleni[];
  services: Storitev[];
}

const STATUS_OPTIONS: { value: AppointmentStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Vsi statusi' },
  { value: 'scheduled', label: 'Načrtovan' },
  { value: 'confirmed', label: 'Potrjen' },
  { value: 'pending', label: 'Čakajoč' },
  { value: 'completed', label: 'Zaključen' },
  { value: 'cancelled', label: 'Odpovedan' },
  { value: 'no_show', label: 'Ni prišel' },
];

function AppointmentFilters({
  filters,
  onFiltersChange,
  employees,
  services,
}: AppointmentFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateFilter = useCallback(
    <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
      onFiltersChange({ ...filters, [key]: value });
    },
    [filters, onFiltersChange]
  );

  const clearFilters = useCallback(() => {
    onFiltersChange({
      search: '',
      status: 'all',
      employeeId: null,
      serviceId: null,
      dateFrom: '',
      dateTo: '',
    });
  }, [onFiltersChange]);

  // Count active filters (excluding search and 'all' status)
  const activeFilterCount = [
    filters.status !== 'all',
    filters.employeeId !== null,
    filters.serviceId !== null,
    filters.dateFrom !== '',
    filters.dateTo !== '',
  ].filter(Boolean).length;

  // Get active filter chips
  const activeFilters: { key: keyof FilterState; label: string }[] = [];

  if (filters.status !== 'all') {
    const statusOption = STATUS_OPTIONS.find((s) => s.value === filters.status);
    activeFilters.push({ key: 'status', label: `Status: ${statusOption?.label}` });
  }
  if (filters.employeeId) {
    const employee = employees.find((e) => e.id === filters.employeeId);
    activeFilters.push({
      key: 'employeeId',
      label: `Zaposleni: ${employee?.ime} ${employee?.priimek}`,
    });
  }
  if (filters.serviceId) {
    const service = services.find((s) => s.id === filters.serviceId);
    activeFilters.push({ key: 'serviceId', label: `Storitev: ${service?.naziv}` });
  }
  if (filters.dateFrom) {
    activeFilters.push({ key: 'dateFrom', label: `Od: ${filters.dateFrom}` });
  }
  if (filters.dateTo) {
    activeFilters.push({ key: 'dateTo', label: `Do: ${filters.dateTo}` });
  }

  const removeFilter = (key: keyof FilterState) => {
    if (key === 'status') {
      updateFilter('status', 'all');
    } else if (key === 'employeeId' || key === 'serviceId') {
      updateFilter(key, null);
    } else {
      updateFilter(key, '');
    }
  };

  // Get status dot color for select options
  const getStatusDotColor = (status: AppointmentStatus | 'all'): string | undefined => {
    if (status === 'all') return undefined;
    const config = getStatusConfig(status);
    // Extract the base color from dotClass (e.g., 'bg-emerald-500' -> '#10B981')
    const colorMap: Record<string, string> = {
      'scheduled': '#8B5CF6',
      'confirmed': '#10B981',
      'pending': '#F59E0B',
      'completed': '#3B82F6',
      'cancelled': '#EF4444',
      'no_show': '#6B7280',
    };
    return colorMap[status];
  };

  return (
    <div className="space-y-4">
      {/* Main filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search input */}
        <div className="relative flex-1 min-w-[280px]">
          <MagnifyingGlass
            className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            weight="regular"
          />
          <input
            type="text"
            placeholder="Išči po imenu stranke, storitvi..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="w-full rounded-xl border-0 bg-white py-2.5 pl-10 pr-4 text-sm text-[#1A1F36]
                       placeholder-gray-400 shadow-sm ring-1 ring-gray-200 transition-all
                       focus:outline-none focus:ring-2 focus:ring-[#1A1F36]/20"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => updateFilter('search', '')}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5
                         text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-4 w-4" weight="bold" />
            </button>
          )}
        </div>

        {/* Status filter - Animated Select */}
        <div className="w-44">
          <Select
            value={filters.status}
            setValue={(value) => updateFilter('status', value as AppointmentStatus | 'all')}
            placeholder="Status"
          >
            {STATUS_OPTIONS.map((option) => (
              <SelectOption
                key={option.value}
                value={option.value}
                colorDot={getStatusDotColor(option.value)}
              >
                {option.label}
              </SelectOption>
            ))}
          </Select>
        </div>

        {/* Toggle more filters */}
        <motion.button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          whileTap={{ scale: 0.98 }}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium
                     shadow-sm transition-all
                     ${isExpanded || activeFilterCount > 0
                       ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white'
                       : 'bg-white text-[#1A1F36] ring-1 ring-gray-200 hover:bg-gray-50'
                     }`}
        >
          <Funnel className="h-4 w-4" weight="bold" />
          Filtri
          {activeFilterCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs">
              {activeFilterCount}
            </span>
          )}
        </motion.button>

        {/* Clear all filters */}
        <AnimatePresence>
          {(activeFilterCount > 0 || filters.search) && (
            <motion.button
              type="button"
              onClick={clearFilters}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium
                         text-gray-500 transition-colors hover:bg-gray-100 hover:text-[#1A1F36]"
            >
              <X className="h-4 w-4" weight="bold" />
              Počisti
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Expanded filters */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex flex-wrap items-end gap-4 rounded-xl bg-gray-50 p-4">
              {/* Employee filter */}
              <div className="flex flex-col gap-1.5 min-w-[180px]">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  Zaposleni
                </label>
                <Select
                  value={filters.employeeId || ''}
                  setValue={(value) => updateFilter('employeeId', value || null)}
                  placeholder="Vsi zaposleni"
                >
                  <SelectOption value="">Vsi zaposleni</SelectOption>
                  {employees.map((employee) => (
                    <SelectOption key={employee.id} value={employee.id}>
                      {employee.ime} {employee.priimek}
                    </SelectOption>
                  ))}
                </Select>
              </div>

              {/* Service filter */}
              <div className="flex flex-col gap-1.5 min-w-[180px]">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  Storitev
                </label>
                <Select
                  value={filters.serviceId || ''}
                  setValue={(value) => updateFilter('serviceId', value || null)}
                  placeholder="Vse storitve"
                >
                  <SelectOption value="">Vse storitve</SelectOption>
                  {services.map((service) => (
                    <SelectOption
                      key={service.id}
                      value={service.id}
                      colorDot={service.barva || '#6366F1'}
                    >
                      {service.naziv}
                    </SelectOption>
                  ))}
                </Select>
              </div>

              {/* Date range */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  Datum od
                </label>
                <div className="relative">
                  <CalendarBlank
                    className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                    weight="regular"
                  />
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => updateFilter('dateFrom', e.target.value)}
                    className="rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3
                               text-sm text-[#1A1F36] focus:outline-none focus:ring-2
                               focus:ring-[#1A1F36]/20"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  Datum do
                </label>
                <div className="relative">
                  <CalendarBlank
                    className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                    weight="regular"
                  />
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => updateFilter('dateTo', e.target.value)}
                    className="rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3
                               text-sm text-[#1A1F36] focus:outline-none focus:ring-2
                               focus:ring-[#1A1F36]/20"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active filter chips */}
      <AnimatePresence>
        {activeFilters.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-wrap gap-2"
          >
            {activeFilters.map((filter) => (
              <motion.span
                key={filter.key}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r
                           from-pink-50 to-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700"
              >
                {filter.label}
                <button
                  type="button"
                  onClick={() => removeFilter(filter.key)}
                  className="rounded-full p-0.5 transition-colors hover:bg-purple-100"
                >
                  <X className="h-3 w-3" weight="bold" />
                </button>
              </motion.span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default memo(AppointmentFilters);
