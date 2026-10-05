'use client';

import { useState, useMemo, useCallback } from 'react';
import { MagnifyingGlass, X } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
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
  /** Unsubscribed from marketing: listed, never selectable. */
  optedOut?: boolean;
}

/**
 * Datum v zapisu YYYY-MM-DD po *krajevnem* času.
 *
 * `toISOString()` pretvori v UTC, zato je v Sloveniji polnočni datum pristal
 * en dan prej in so se meje dneva, tedna in meseca izmaknile za dan.
 */
function ymd(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
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
  const t = useTranslations('communication');
  const [search, setSearch] = useState('');
  // Start with everyone; 'today' often showed 0 clients and looked broken.
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedService, setSelectedService] = useState('Vse storitve');

  /** Meje današnjega dne, jutrišnjega, tedna in meseca — v enakem zapisu
   *  kot appointmentDates, torej YYYY-MM-DD. */
  const ranges = useMemo(() => {
    const now = new Date();
    const todayStr = ymd(now);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = ymd(tomorrow);

    // Start of this week (Monday) and end (Sunday)
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const weekStartStr = ymd(weekStart);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const weekEndStr = ymd(weekEnd);

    // Start and end of this month
    const monthStartStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const monthEndStr = ymd(monthEnd);

    return { todayStr, tomorrowStr, weekStartStr, weekEndStr, monthStartStr, monthEndStr };
  }, []);

  /** Ali stranka pade v dano skupino. Ista pravila kot prej, samo izvlečena,
   *  da jih lahko uporabimo tudi za števila na gumbih. */
  const matchesFilter = useCallback(
    (c: Customer, filter: string) => {
      const { todayStr, tomorrowStr, weekStartStr, weekEndStr, monthStartStr, monthEndStr } = ranges;
      switch (filter) {
        case 'today':
          if (c.appointmentDates) return c.appointmentDates.includes(todayStr);
          return c.nextAppointment ? c.nextAppointment.startsWith(todayStr) : false;
        case 'tomorrow':
          if (c.appointmentDates) return c.appointmentDates.includes(tomorrowStr);
          return c.nextAppointment ? c.nextAppointment.startsWith(tomorrowStr) : false;
        case 'this-week':
          if (c.appointmentDates) return c.appointmentDates.some((d) => d >= weekStartStr && d <= weekEndStr);
          if (!c.nextAppointment) return false;
          return c.nextAppointment.split('T')[0] >= weekStartStr && c.nextAppointment.split('T')[0] <= weekEndStr;
        case 'this-month':
          if (c.appointmentDates) return c.appointmentDates.some((d) => d >= monthStartStr && d <= monthEndStr);
          if (!c.nextAppointment) return false;
          return c.nextAppointment.split('T')[0] >= monthStartStr && c.nextAppointment.split('T')[0] <= monthEndStr;
        default:
          return true;
      }
    },
    [ranges],
  );

  const counts = useMemo(
    () =>
      ['all', 'today', 'tomorrow', 'this-week', 'this-month'].reduce<Record<string, number>>(
        (acc, id) => {
          acc[id] = customers.filter((c) => matchesFilter(c, id)).length;
          return acc;
        },
        {},
      ),
    [customers, matchesFilter],
  );

  const filteredCustomers = useMemo(() => {
    let result = customers.filter((c) => matchesFilter(c, activeFilter));

    if (search.trim()) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(searchLower) ||
          c.email.toLowerCase().includes(searchLower) ||
          c.phone.includes(searchLower)
      );
    }

    return result;
  }, [customers, search, activeFilter, matchesFilter]);

  const toggleCustomer = useCallback(
    (id: string) => {
      if (customers.find((c) => c.id === id)?.optedOut) return;
      const next = new Set(selectedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      onSelectionChange(next);
    },
    [selectedIds, onSelectionChange, customers]
  );

  const selectAll = useCallback(() => {
    const allIds = new Set(filteredCustomers.filter((c) => !c.optedOut).map((c) => c.id));
    onSelectionChange(allIds);
  }, [filteredCustomers, onSelectionChange]);

  const deselectAll = useCallback(() => {
    onSelectionChange(new Set());
  }, [onSelectionChange]);

  const selectable = filteredCustomers.filter((c) => !c.optedOut);
  const selectedInFiltered = selectable.filter((c) => selectedIds.has(c.id)).length;
  const allSelected = selectable.length > 0 && selectedInFiltered === selectable.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Skupine s številom — najprej izbereš skupino, posamične stranke pa
          odkljukaš le še kot izjeme. */}
      <CustomerFilters
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        onServiceFilterChange={setSelectedService}
        selectedService={selectedService}
        counts={counts}
      />

      {/* Search */}
      <div className="relative">
        <MagnifyingGlass className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" weight="regular" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('customerList.searchPlaceholder')}
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-10 text-sm text-gray-900 placeholder:text-gray-400 transition-colors focus:border-[#7C78FA] focus:outline-none focus:ring-[3px] focus:ring-[#7C78FA]/25"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
          >
            <X className="h-3.5 w-3.5" weight="regular" />
          </button>
        )}
      </div>

      {/* Seznam je ena kartica; vrstice ločijo lasne črte. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-100 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
          <button
            type="button"
            onClick={allSelected ? deselectAll : selectAll}
            className="text-[13px] font-medium text-[#7C78FA] transition-opacity hover:opacity-70 disabled:opacity-40"
            disabled={filteredCustomers.length === 0}
          >
            {allSelected
              ? t('customerList.deselectAll')
              : t('customerList.selectAll')}
          </button>
          <span className="tnum text-[13px] text-gray-400">
            {t('customerList.resultCount', { count: filteredCustomers.length })}
          </span>
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 divide-y divide-gray-100 overflow-y-auto">
          {loading ? (
            <div>
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex animate-pulse items-center gap-3 px-4 py-2.5">
                  <div className="h-5 w-5 rounded-full bg-gray-200" />
                  <div className="h-4 w-7 rounded bg-gray-200" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-28 rounded bg-gray-200" />
                    <div className="h-3 w-40 rounded bg-gray-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredCustomers.length > 0 ? (
            filteredCustomers.map((customer) => (
              <CustomerListItem
                key={customer.id}
                customer={customer}
                selected={selectedIds.has(customer.id)}
                onToggle={toggleCustomer}
              />
            ))
          ) : (
            <div className="py-12 text-center">
              <p className="text-sm text-gray-400">{t('customerList.empty')}</p>
              {activeFilter !== 'all' || search ? (
                <button
                  type="button"
                  onClick={() => {
                    setActiveFilter('all');
                    setSearch('');
                  }}
                  className="mt-3 rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-900 transition-colors hover:bg-gray-50"
                >
                  {t('customerList.showAll')}
                </button>
              ) : (
                <p className="mt-1 text-xs text-gray-400">{t('customerList.emptyNoClients')}</p>
              )}
            </div>
          )}
        </div>

        {/* Števec izbranih ostane viden tudi med drsenjem po seznamu. */}
        <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-4 py-2.5">
          <span className="tnum text-[13px] font-medium text-gray-900">
            {t('customerList.selectedCount', { count: selectedIds.size })}
          </span>
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={deselectAll}
              className="text-[13px] font-medium text-gray-500 transition-colors hover:text-gray-900"
            >
              {t('customerList.deselectAll')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
