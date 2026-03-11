'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion } from 'motion/react';
import { MagnifyingGlass, X, CheckSquare, MinusSquare } from '@phosphor-icons/react';
import CustomerFilters from './CustomerFilters';
import CustomerListItem from './CustomerListItem';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  nextAppointment: string | null;
  lastVisit: string;
  tags: string[];
  /** ISO date-only strings (YYYY-MM-DD) of all appointments for date-based filtering */
  appointmentDates?: string[];
}

interface CustomerListProps {
  customers: Customer[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  loading?: boolean;
}

export default function CustomerList({
  customers,
  selectedIds,
  onSelectionChange,
  loading = false,
}: CustomerListProps) {
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('today');
  const [selectedService, setSelectedService] = useState('Vse storitve');

  // Filter customers based on search and active filter
  const filteredCustomers = useMemo(() => {
    let result = customers;

    // Search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(searchLower) ||
          c.email.toLowerCase().includes(searchLower) ||
          c.phone.includes(searchLower)
      );
    }

    // Quick filters — use appointmentDates (date-only strings) when available
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // Start of this week (Monday) and end (Sunday)
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    // Start and end of this month
    const monthStartStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const monthEndStr = monthEnd.toISOString().split('T')[0];

    switch (activeFilter) {
      case 'today':
        result = result.filter((c) => {
          if (c.appointmentDates) return c.appointmentDates.includes(todayStr);
          // fallback: use nextAppointment
          if (!c.nextAppointment) return false;
          return c.nextAppointment.startsWith(todayStr);
        });
        break;
      case 'tomorrow':
        result = result.filter((c) => {
          if (c.appointmentDates) return c.appointmentDates.includes(tomorrowStr);
          if (!c.nextAppointment) return false;
          return c.nextAppointment.startsWith(tomorrowStr);
        });
        break;
      case 'this-week':
        result = result.filter((c) => {
          if (c.appointmentDates) {
            return c.appointmentDates.some((d) => d >= weekStartStr && d <= weekEndStr);
          }
          if (!c.nextAppointment) return false;
          const d = c.nextAppointment.split('T')[0];
          return d >= weekStartStr && d <= weekEndStr;
        });
        break;
      case 'this-month':
        result = result.filter((c) => {
          if (c.appointmentDates) {
            return c.appointmentDates.some((d) => d >= monthStartStr && d <= monthEndStr);
          }
          if (!c.nextAppointment) return false;
          const d = c.nextAppointment.split('T')[0];
          return d >= monthStartStr && d <= monthEndStr;
        });
        break;
    }

    return result;
  }, [customers, search, activeFilter]);

  const toggleCustomer = useCallback(
    (id: string) => {
      const next = new Set(selectedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      onSelectionChange(next);
    },
    [selectedIds, onSelectionChange]
  );

  const selectAll = useCallback(() => {
    const allIds = new Set(filteredCustomers.map((c) => c.id));
    onSelectionChange(allIds);
  }, [filteredCustomers, onSelectionChange]);

  const deselectAll = useCallback(() => {
    onSelectionChange(new Set());
  }, [onSelectionChange]);

  const selectedInFiltered = filteredCustomers.filter((c) => selectedIds.has(c.id)).length;
  const allSelected = filteredCustomers.length > 0 && selectedInFiltered === filteredCustomers.length;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <CustomerFilters
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        onServiceFilterChange={setSelectedService}
        selectedService={selectedService}
      />

      {/* Search */}
      <div className="relative">
        <MagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" weight="regular" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Išči stranko po imenu, emailu ali telefonu..."
          className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-[#1A1F36] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X className="h-3.5 w-3.5" weight="bold" />
          </button>
        )}
      </div>

      {/* Selection controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={allSelected ? deselectAll : selectAll}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#1A1F36] transition-colors"
          >
            {allSelected ? (
              <MinusSquare className="h-5 w-5 text-violet-500" weight="fill" />
            ) : (
              <CheckSquare className="h-5 w-5" weight="regular" />
            )}
            <span>{allSelected ? 'Odznači vse' : 'Izberi vse'}</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="px-3 py-1 rounded-lg bg-violet-50 text-xs font-semibold text-violet-600 border border-violet-200"
            >
              Izbrano: {selectedIds.size}
            </motion.span>
          )}
          <span className="text-xs text-gray-400">
            {filteredCustomers.length} {filteredCustomers.length === 1 ? 'stranka' : 'strank'}
          </span>
        </div>
      </div>

      {/* Customer list */}
      <div className="space-y-2 max-h-[calc(100vh-480px)] overflow-y-auto custom-scrollbar pr-1">
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 animate-pulse">
                <div className="w-5 h-5 rounded-full bg-gray-200" />
                <div className="flex-shrink-0 w-8 h-4 rounded bg-gray-200" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-28 rounded bg-gray-200" />
                  <div className="h-3 w-40 rounded bg-gray-100" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredCustomers.length > 0 ? (
          filteredCustomers.map((customer, index) => (
            <CustomerListItem
              key={customer.id}
              customer={customer}
              selected={selectedIds.has(customer.id)}
              onToggle={toggleCustomer}
              index={index}
            />
          ))
        ) : (
          <div className="py-12 text-center">
            <p className="text-sm text-gray-400">Ni strank za prikaz</p>
            <p className="text-xs text-gray-300 mt-1">Spremenite filtre ali iskanje</p>
          </div>
        )}
      </div>
    </div>
  );
}
