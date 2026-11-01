'use client';

import { MapPin } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { useLocationScope } from '@/app/location-context';

/** Top-bar location filter. Renders nothing for a single-location company. */
export function LocationSwitcher() {
  const t = useTranslations('settings.locations');
  const { locations, multi, selectedLocationId, setSelectedLocationId } = useLocationScope();
  if (!multi) return null;

  return (
    <label className="mr-1 flex h-8 items-center gap-1.5 rounded-lg bg-gray-50 px-2 text-sm text-gray-600 transition-colors hover:bg-gray-100">
      <MapPin weight="regular" className="h-4 w-4 flex-shrink-0 text-gray-400" aria-hidden="true" />
      <span className="sr-only">{t('switcherLabel')}</span>
      <select
        value={selectedLocationId ?? ''}
        onChange={(e) => setSelectedLocationId(e.target.value || null)}
        className="max-w-[140px] cursor-pointer truncate bg-transparent text-sm font-medium text-gray-800 outline-none"
      >
        <option value="">{t('allLocations')}</option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>{l.naziv}</option>
        ))}
      </select>
    </label>
  );
}
