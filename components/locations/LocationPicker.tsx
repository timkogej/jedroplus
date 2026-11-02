'use client';

import { useTranslations } from 'next-intl';
import type { Location } from '@/types/locations';

type Props = {
  locations: Location[];
  value: string[];
  onChange: (ids: string[]) => void;
  /** 'staff': where the person works; 'service': where it is offered. */
  kind: 'staff' | 'service';
};

/** Checkbox list of locations; at least one must stay selected. */
export function LocationPicker({ locations, value, onChange, kind }: Props) {
  const t = useTranslations('settings.locations');

  const toggle = (id: string) => {
    if (value.includes(id)) {
      if (value.length > 1) onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-gray-900">
        {kind === 'staff' ? t('pickerStaff') : t('pickerService')}
      </legend>
      <div className="space-y-1.5">
        {locations.map((l) => (
          <label key={l.id} className="flex min-h-[36px] cursor-pointer items-center gap-2.5 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={value.includes(l.id)}
              onChange={() => toggle(l.id)}
              className="h-4 w-4 accent-violet-600"
            />
            <span>{l.naziv}</span>
            {l.je_glavna && <span className="text-xs text-gray-400">{t('main')}</span>}
          </label>
        ))}
      </div>
      <p className="text-xs text-gray-500">
        {kind === 'staff' ? t('pickerStaffHelp') : t('pickerServiceHelp')}
      </p>
    </fieldset>
  );
}
