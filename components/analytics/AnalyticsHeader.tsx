'use client';

import { memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CalendarBlank, DownloadSimple } from '@phosphor-icons/react';
import { format } from 'date-fns';
import { useTranslations } from 'next-intl';
import { type TimePeriod, type CustomRange } from '@/lib/analytics/dateUtils';

interface AnalyticsHeaderProps {
  timePeriod: TimePeriod;
  setTimePeriod: (period: TimePeriod) => void;
  customRange: CustomRange;
  setCustomRange: (range: CustomRange) => void;
  onExportCSV?: () => void;
}

function AnalyticsHeader({
  timePeriod,
  setTimePeriod,
  customRange,
  setCustomRange,
  onExportCSV,
}: AnalyticsHeaderProps) {
  const t = useTranslations('analytics');

  const TIME_PERIODS: { value: TimePeriod; label: string }[] = [
    { value: 'danes', label: t('periods.danes') },
    { value: 'ta_teden', label: t('periods.ta_teden') },
    { value: 'ta_mesec', label: t('periods.ta_mesec') },
    { value: 'zadnjih_30', label: t('periods.zadnjih_30') },
    { value: 'ta_leto', label: t('periods.ta_leto') },
    { value: 'custom', label: t('periods.custom') },
  ];

  const handleApplyCustomRange = () => {
    setTimePeriod('custom');
  };

  return (
    <div className="mb-7">
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
        className="mb-5 flex flex-wrap items-start justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">{t('page.title')}</h1>
          <p className="mt-0.5 text-base text-gray-500">{t('page.subtitle')}</p>
        </div>

        {/* Izvoz je bil doslej speljan v komponento, a gumba ni nihče izrisal,
            zato do izvoza ni bilo mogoče priti. */}
        {onExportCSV && (
          <button
            type="button"
            onClick={onExportCSV}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 active:bg-gray-100"
          >
            <DownloadSimple size={17} weight="regular" className="text-gray-500" />
            {t('page.exportButton')}
          </button>
        )}
      </motion.div>

      {/* Obdobje */}
      <div className="flex flex-wrap gap-1.5">
        {TIME_PERIODS.map((period) => (
          <button
            key={period.value}
            type="button"
            onClick={() => setTimePeriod(period.value)}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
              timePeriod === period.value
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {period.label}
          </button>
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
                <label className="mb-1 block text-[13px] font-medium text-gray-500">
                  {t('customRange.fromLabel')}
                </label>
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
                    className="rounded-xl border border-gray-200 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 transition-colors focus:border-[#7C78FA] focus:outline-none focus:ring-[3px] focus:ring-[#7C78FA]/25"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-medium text-gray-500">
                  {t('customRange.toLabel')}
                </label>
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
                    className="rounded-xl border border-gray-200 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 transition-colors focus:border-[#7C78FA] focus:outline-none focus:ring-[3px] focus:ring-[#7C78FA]/25"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleApplyCustomRange}
                disabled={!customRange.start || !customRange.end}
                className="rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:bg-none disabled:bg-gray-100 disabled:text-gray-400 disabled:shadow-none"
              >
                {t('customRange.applyButton')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default memo(AnalyticsHeader);
