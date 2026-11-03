'use client';

import { MapPin } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { useLocationScope } from '@/app/location-context';

/** Top-bar location filter. Renders nothing for a single-location company. */
export function LocationSwitcher() {
  const t = useTranslations('settings.locations');
  const { locations, multi, selectedLocationId, setSelectedLocationId } = useLocationScope();
  if (!multi) return null;

  const current = locations.find((l) => l.id === selectedLocationId)?.naziv ?? t('allLocations');
  const filtered = selectedLocationId !== null;

  // Icon only, like the other buttons in the bar. The real <select> sits invisibly
  // on top, so it opens the native picker (a sheet on phones) and stays accessible.
  return (
    <label
      title={current}
      className="relative flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-md text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200"
    >
      <MapPin weight={filtered ? 'fill' : 'regular'} className={`h-5 w-5 ${filtered ? 'text-violet-600' : ''}`} aria-hidden="true" />
      <span className="sr-only">{t('switcherLabel')}: {current}</span>
      <select
        value={selectedLocationId ?? ''}
        onChange={(e) => setSelectedLocationId(e.target.value || null)}
        aria-label={t('switcherLabel')}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
      >
        <option value="">{t('allLocations')}</option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>{l.naziv}</option>
        ))}
      </select>
    </label>
  );
}
