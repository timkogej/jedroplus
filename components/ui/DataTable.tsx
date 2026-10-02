'use client';

import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  CaretUp,
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretDoubleLeft,
  CaretDoubleRight,
} from '@phosphor-icons/react';

export type SortDirection = 'asc' | 'desc';

export interface DataTableColumn<T> {
  /** Stabilen ključ stolpca — po njem teče razvrščanje. */
  id: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  /** Če je podan, je stolpec klikljiv za razvrščanje. */
  sortValue?: (row: T) => string | number;
  align?: 'left' | 'right';
  /** Dodatni razredi za celico (npr. fiksna širina). */
  cellClassName?: string;
}

/**
 * Kako se vrstica pokaže na telefonu. Tabela s sedmimi stolpci se na 375px
 * ne skrči — zato se pod `sm` sploh ne izriše, namesto nje pa teče seznam,
 * kot ga ima Apple v Mailu ali Stikih.
 */
export interface DataTableMobileRow<T> {
  /** Levo: začetnice, barvna pika … */
  leading?: (row: T) => React.ReactNode;
  /** Glavna vrstica. */
  title: (row: T) => React.ReactNode;
  /** Drobna vrstica pod naslovom. */
  subtitle?: (row: T) => React.ReactNode;
  /** Še ena drobna vrstica — npr. značka stanja. */
  meta?: (row: T) => React.ReactNode;
  /** Desno: gumbi za akcije. */
  trailing?: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  rows: T[];
  columns: DataTableColumn<T>[];
  rowKey: (row: T, index: number) => string;
  mobile: DataTableMobileRow<T>;
  defaultSort?: { columnId: string; direction: SortDirection };
  /** Brez vrednosti ni paginacije. */
  pageSize?: number;
  isLoading?: boolean;
  /** Prazno stanje — komponenta ga samo prikaže, ne oblikuje. */
  empty?: React.ReactNode;
  rowClassName?: (row: T) => string;
  /** Beseda med "1–20" in skupnim številom, npr. "od". */
  ofLabel?: string;
}

function SortIndicator({ active, direction }: { active: boolean; direction: SortDirection }) {
  return (
    <span className={`transition-opacity ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}>
      {active && direction === 'asc' ? (
        <CaretUp className="h-3 w-3" weight="bold" />
      ) : (
        <CaretDown className="h-3 w-3" weight="bold" />
      )}
    </span>
  );
}

function TableSkeleton({ columnCount }: { columnCount: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {Array.from({ length: columnCount }).map((_, i) => (
                <th key={i} className="px-4 py-3.5">
                  <div className="h-3 w-16 animate-pulse rounded bg-gray-200" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {Array.from({ length: 8 }).map((_, rowIndex) => (
              <tr key={rowIndex}>
                {Array.from({ length: columnCount }).map((_, colIndex) => (
                  <td key={colIndex} className="px-4 py-3.5">
                    <div
                      className="h-4 animate-pulse rounded bg-gray-100"
                      style={{
                        width: colIndex === 2 ? '120px' : '70px',
                        animationDelay: `${(rowIndex * columnCount + colIndex) * 50}ms`,
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Telefon */}
      <div className="divide-y divide-gray-100 sm:hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3.5">
            <div className="h-9 w-9 flex-shrink-0 animate-pulse rounded-full bg-gray-100" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-1/2 animate-pulse rounded bg-gray-100" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Skupna tabela za sezname po aplikaciji.
 *
 * Razvrščanje, paginacija, stanje nalaganja in mobilni seznam so tu enkrat,
 * stolpce pa vsak seznam opiše sam. Klicatelj ostane lastnik vsebine celic —
 * komponenta ne ve nič o terminih, strankah ali njihovih akcijah.
 */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  mobile,
  defaultSort,
  pageSize,
  isLoading = false,
  empty,
  rowClassName,
  ofLabel = 'od',
}: DataTableProps<T>) {
  const [sortColumnId, setSortColumnId] = useState<string | null>(defaultSort?.columnId ?? null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultSort?.direction ?? 'asc');
  const [currentPage, setCurrentPage] = useState(1);

  const handleSort = (columnId: string) => {
    if (sortColumnId === columnId) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumnId(columnId);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const sortedRows = useMemo(() => {
    const column = columns.find((c) => c.id === sortColumnId);
    if (!column?.sortValue) return rows;
    const read = column.sortValue;

    return [...rows].sort((a, b) => {
      const aValue = read(a);
      const bValue = read(b);

      // Slovenska abeceda: č, š in ž morajo pasti na svoje mesto, zato
      // localeCompare namesto navadne primerjave znakov.
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const cmp = aValue.localeCompare(bValue, 'sl');
        return sortDirection === 'asc' ? cmp : -cmp;
      }
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [rows, columns, sortColumnId, sortDirection]);

  const totalPages = pageSize ? Math.ceil(sortedRows.length / pageSize) : 1;
  // Ko filtriranje skrči seznam, je lahko trenutna stran čez rob.
  const page = Math.min(currentPage, Math.max(1, totalPages));
  const visibleRows = pageSize
    ? sortedRows.slice((page - 1) * pageSize, page * pageSize)
    : sortedRows;

  if (isLoading) {
    return <TableSkeleton columnCount={columns.length} />;
  }

  if (rows.length === 0) {
    return <>{empty}</>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
      className="overflow-hidden rounded-xl border border-gray-100 bg-white"
    >
      {/* ── Računalnik: tabela ─────────────────────────────────────────── */}
      <div className="custom-scrollbar hidden overflow-x-auto sm:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {columns.map((column) => (
                <th
                  key={column.id}
                  className={`px-4 py-3.5 text-[11px] uppercase tracking-wider text-gray-500 ${
                    column.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {column.sortValue ? (
                    <button
                      type="button"
                      onClick={() => handleSort(column.id)}
                      className={`group flex items-center gap-1.5 text-left uppercase leading-tight tracking-wider transition-colors hover:text-gray-900 ${
                        column.align === 'right' ? 'ml-auto' : ''
                      }`}
                    >
                      {column.header}
                      <SortIndicator active={sortColumnId === column.id} direction={sortDirection} />
                    </button>
                  ) : (
                    <span className="leading-tight">{column.header}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <motion.tbody
            key={page}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="divide-y divide-gray-100"
          >
            {visibleRows.map((row, index) => (
              <tr
                key={rowKey(row, index)}
                className={`group transition-colors hover:bg-gray-50 ${rowClassName?.(row) ?? ''}`}
              >
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className={`px-4 py-3.5 ${column.align === 'right' ? 'text-right' : ''} ${
                      column.cellClassName ?? ''
                    }`}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </motion.tbody>
        </table>
      </div>

      {/* ── Telefon: seznam ────────────────────────────────────────────── */}
      <div className="divide-y divide-gray-100 sm:hidden">
        {visibleRows.map((row, index) => (
          <div
            key={rowKey(row, index)}
            className={`flex items-center gap-3 px-4 py-3 ${rowClassName?.(row) ?? ''}`}
          >
            {mobile.leading && <div className="flex-shrink-0">{mobile.leading(row)}</div>}

            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-medium text-gray-900">
                {mobile.title(row)}
              </div>
              {mobile.subtitle && (
                <div className="mt-0.5 truncate text-[13px] text-gray-500">
                  {mobile.subtitle(row)}
                </div>
              )}
              {mobile.meta && <div className="mt-1.5">{mobile.meta(row)}</div>}
            </div>

            {mobile.trailing && (
              <div className="flex flex-shrink-0 items-center [&_button:not([role=switch])]:p-1.5">{mobile.trailing(row)}</div>
            )}
          </div>
        ))}
      </div>

      {/* ── Paginacija ─────────────────────────────────────────────────── */}
      {pageSize && totalPages > 1 && (
        <div className="flex flex-col items-center gap-2 border-t border-gray-100 px-4 py-3 sm:flex-row sm:justify-between sm:gap-4">
          <p className="tnum text-sm text-gray-500">
            <span className="font-medium text-gray-900">{(page - 1) * pageSize + 1}</span>
            {' – '}
            <span className="font-medium text-gray-900">
              {Math.min(page * pageSize, sortedRows.length)}
            </span>{' '}
            {ofLabel} <span className="font-medium text-gray-900">{sortedRows.length}</span>
          </p>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={page === 1}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CaretDoubleLeft className="h-4 w-4" weight="bold" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CaretLeft className="h-4 w-4" weight="bold" />
            </button>

            <div className="flex items-center gap-1 px-1">
              {buildPageList(page, totalPages).map((entry, idx) =>
                typeof entry === 'number' ? (
                  <button
                    key={entry}
                    type="button"
                    onClick={() => setCurrentPage(entry)}
                    className={`tnum flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                      page === entry
                        ? 'bg-gray-900 text-white'
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    {entry}
                  </button>
                ) : (
                  <span
                    key={`${entry}-${idx}`}
                    className="flex h-8 w-6 select-none items-end justify-center pb-0.5 text-sm text-gray-400"
                  >
                    …
                  </span>
                ),
              )}
            </div>

            <button
              type="button"
              onClick={() => setCurrentPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CaretRight className="h-4 w-4" weight="bold" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              disabled={page === totalPages}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CaretDoubleRight className="h-4 w-4" weight="bold" />
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

/** Do pet strani jih naštejemo vse, sicer prva, zadnja in okolica trenutne. */
function buildPageList(current: number, total: number): (number | 'gap-left' | 'gap-right')[] {
  if (total <= 5) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: (number | 'gap-left' | 'gap-right')[] = [1];
  if (current > 3) pages.push('gap-left');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push('gap-right');
  pages.push(total);
  return pages;
}

export default DataTable;
