'use client';

import { CalendarBlank, Clock, EnvelopeSimple, Phone } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import type { ZahtevaTermina } from '@/lib/supabase/zahteveTermini';

/**
 * Povzetek zahteve v okencih za potrditev in zavrnitev: kdo je zahteval,
 * kaj želi in kdaj — isti podatki kot na kartici v seznamu zahtev.
 */
export function RequestSummary({ zahteva }: { zahteva: ZahtevaTermina }) {
  const t = useTranslations('zahteve-termini');
  const name = `${zahteva.ime} ${zahteva.priimek}`.trim();

  return (
    <div className="overflow-hidden rounded-xl bg-white">
      <div className="px-4 py-3">
        <p className="text-[15px] font-semibold text-gray-900">{name}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-gray-500">
          {zahteva.email && (
            <a href={`mailto:${zahteva.email}`} className="inline-flex items-center gap-1 hover:text-gray-900">
              <EnvelopeSimple className="h-3.5 w-3.5" weight="regular" />
              {zahteva.email}
            </a>
          )}
          {zahteva.telefon && (
            <a href={`tel:${zahteva.telefon}`} className="tnum inline-flex items-center gap-1 hover:text-gray-900">
              <Phone className="h-3.5 w-3.5" weight="regular" />
              {zahteva.telefon}
            </a>
          )}
        </div>
        {zahteva.opis_zelje && (
          <p className="mt-2 text-sm leading-6 text-gray-700">{zahteva.opis_zelje}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-100 px-4 py-2.5 text-[13px] text-gray-500">
        <span className="tnum inline-flex items-center gap-1.5">
          <CalendarBlank className="h-3.5 w-3.5" weight="regular" />
          {t('card.preferredRange', { from: zahteva.zeljeni_datum_od, to: zahteva.zeljeni_datum_do })}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" weight="regular" />
          {t(`delDneva.${zahteva.zeljeni_del_dneva}`)}
        </span>
      </div>
    </div>
  );
}
