'use client';

import { Plus, X } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { Switch, TimePicker } from '@/components/settings';
import type { TimeInterval, WorkingHoursDay } from '@/types/settings';
import { defaultWorkingHoursDay } from '@/types/settings';

// SL day names are DB schema keys — must not be translated
const DAYS_OF_WEEK = ['Ponedeljek', 'Torek', 'Sreda', 'Četrtek', 'Petek', 'Sobota', 'Nedelja'];
const DAY_KEYS: Record<string, 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'> = {
  Ponedeljek: 'mon',
  Torek: 'tue',
  Sreda: 'wed',
  Četrtek: 'thu',
  Petek: 'fri',
  Sobota: 'sat',
  Nedelja: 'sun',
};

export type WorkingHours = Record<string, WorkingHoursDay>;

/** Parses a stored "urnik" (JSON text or object); falls back to the default week. */
export function parseWorkingHours(value: unknown): WorkingHours {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return structuredClone(defaultWorkingHoursDay);
    }
  }
  if (!parsed || typeof parsed !== 'object') return structuredClone(defaultWorkingHoursDay);

  const data = parsed as Record<string, unknown>;
  const result: WorkingHours = {};
  for (const day of DAYS_OF_WEEK) {
    const d = data[day];
    if (d && typeof d === 'object') {
      const entry = d as Record<string, unknown>;
      result[day] = Array.isArray(entry.intervals) && entry.intervals.length > 0
        ? { enabled: Boolean(entry.enabled), intervals: entry.intervals as TimeInterval[] }
        : {
            enabled: Boolean(entry.enabled),
            intervals: [{ start: String(entry.start || '08:00'), end: String(entry.end || '17:00') }],
          };
    } else {
      result[day] = structuredClone(defaultWorkingHoursDay[day]);
    }
  }
  return result;
}

type Props = {
  value: WorkingHours;
  onChange: (next: WorkingHours) => void;
};

/** Controlled weekly opening-hours editor (same format as "Podatki podjetij".urnik). */
export function WorkingHoursEditor({ value, onChange }: Props) {
  const t = useTranslations('settings');
  const tc = useTranslations('common');

  const setDay = (day: string, next: Partial<WorkingHoursDay>) =>
    onChange({ ...value, [day]: { ...value[day], ...next } });

  const setInterval = (day: string, index: number, field: 'start' | 'end', time: string) => {
    const intervals = [...(value[day]?.intervals ?? [])];
    intervals[index] = { ...intervals[index], [field]: time };
    setDay(day, { intervals });
  };

  const addInterval = (day: string) => {
    const intervals = value[day]?.intervals ?? [];
    const last = intervals[intervals.length - 1];
    setDay(day, { intervals: [...intervals, { start: last?.end || '12:00', end: '17:00' }] });
  };

  const removeInterval = (day: string, index: number) => {
    const intervals = (value[day]?.intervals ?? []).filter((_, i) => i !== index);
    setDay(day, { intervals: intervals.length > 0 ? intervals : [{ start: '08:00', end: '17:00' }] });
  };

  return (
    <div className="space-y-4">
      {DAYS_OF_WEEK.map((day) => {
        const hours = value[day] ?? { enabled: false, intervals: [{ start: '08:00', end: '17:00' }] };
        return (
          <div key={day} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900">{tc(`daysLong.${DAY_KEYS[day]}`)}</span>
              <Switch checked={hours.enabled} onChange={(enabled) => setDay(day, { enabled })} />
            </div>

            {hours.enabled ? (
              <div className="space-y-2">
                {hours.intervals.map((interval, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="flex flex-1 items-center gap-2">
                      <TimePicker value={interval.start} onChange={(time) => setInterval(day, idx, 'start', time)} />
                      <span className="text-gray-500">-</span>
                      <TimePicker value={interval.end} onChange={(time) => setInterval(day, idx, 'end', time)} />
                    </div>
                    {hours.intervals.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeInterval(day, idx)}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addInterval(day)}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[#7C78FA] transition-opacity hover:opacity-80"
                >
                  <Plus className="h-4 w-4" />
                  {t('company.workingHours.addInterval')}
                </button>
              </div>
            ) : (
              <span className="text-sm text-gray-400">{t('company.workingHours.closed')}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
