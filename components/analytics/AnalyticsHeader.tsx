'use client';

import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DownloadSimple, FileText, Table, FileCsv, X, CalendarBlank } from '@phosphor-icons/react';
import { format } from 'date-fns';
import { sl } from 'date-fns/locale';
import { type TimePeriod, type CustomRange, getPeriodLabel } from '@/lib/analytics/dateUtils';

interface AnalyticsHeaderProps {
  timePeriod: TimePeriod;
  setTimePeriod: (period: TimePeriod) => void;
  customRange: CustomRange;
  setCustomRange: (range: CustomRange) => void;
  onExportCSV: () => void;
}

const TIME_PERIODS: { value: TimePeriod; label: string }[] = [
  { value: 'danes', label: 'Danes' },
  { value: 'ta_teden', label: 'Ta Teden' },
  { value: 'ta_mesec', label: 'Ta Mesec' },
  { value: 'zadnjih_30', label: 'Zadnjih 30 Dni' },
  { value: 'ta_leto', label: 'Letos' },
  { value: 'custom', label: 'Obdobje po Meri' },
];

function AnalyticsHeader({
  timePeriod,
  setTimePeriod,
  customRange,
  setCustomRange,
  onExportCSV,
}: AnalyticsHeaderProps) {
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleApplyCustomRange = () => {
    // Custom range is already set, just close the picker by changing to custom
    setTimePeriod('custom');
  };

  return (
    <div className="mb-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Title */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analitika</h1>
          <p className="mt-1 text-gray-600">Pregled poslovanja in ključnih metrik</p>
        </div>

        {/* Export Button */}
        <div className="relative">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-cyan-500/25 transition-all hover:shadow-xl hover:shadow-cyan-500/30"
          >
            <DownloadSimple className="h-4 w-4" weight="bold" />
            Izvozi Podatke
          </motion.button>

          {/* Export Dropdown */}
          <AnimatePresence>
            {showExportMenu && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute right-0 z-10 mt-2 w-48 rounded-xl border border-gray-200 bg-white py-2 shadow-lg"
              >
                <button
                  onClick={() => {
                    onExportCSV();
                    setShowExportMenu(false);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <FileCsv className="h-4 w-4" weight="regular" />
                  Izvozi kot CSV
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Time Period Pills */}
      <div className="flex flex-wrap gap-3">
        {TIME_PERIODS.map((period) => (
          <motion.button
            key={period.value}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setTimePeriod(period.value)}
            className={`rounded-xl px-4 py-2 font-medium transition-all ${
              timePeriod === period.value
                ? 'bg-gradient-to-r from-violet-500 to-cyan-500 text-white shadow-lg'
                : 'border border-gray-200 bg-white text-gray-700 hover:border-violet-300'
            }`}
          >
            {period.label}
          </motion.button>
        ))}
      </div>

      {/* Custom Date Range Picker */}
      <AnimatePresence>
        {timePeriod === 'custom' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 overflow-hidden"
          >
            <div className="flex flex-wrap items-end gap-4 rounded-xl bg-gray-50 p-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Od:</label>
                <div className="relative">
                  <CalendarBlank className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="date"
                    value={customRange.start ? format(customRange.start, 'yyyy-MM-dd') : ''}
                    onChange={(e) =>
                      setCustomRange({
                        ...customRange,
                        start: e.target.value ? new Date(e.target.value) : null,
                      })
                    }
                    className="rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Do:</label>
                <div className="relative">
                  <CalendarBlank className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="date"
                    value={customRange.end ? format(customRange.end, 'yyyy-MM-dd') : ''}
                    onChange={(e) =>
                      setCustomRange({
                        ...customRange,
                        end: e.target.value ? new Date(e.target.value) : null,
                      })
                    }
                    className="rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                  />
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleApplyCustomRange}
                disabled={!customRange.start || !customRange.end}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
              >
                Uporabi
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default memo(AnalyticsHeader);
