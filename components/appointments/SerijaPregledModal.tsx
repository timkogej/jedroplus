'use client';

// Ponavljajoči termin: pregled vseh datumov pred shranjevanjem. Vsak datum je označen
// (prosto / predlog drugega časa / ni prostega), uporabnik ga lahko izklopi ali spremeni.
// Shrani koledar: vsak termin posebej po isti poti kot en termin (potrdilo, resursi).

import { CheckCircle, Warning, XCircle } from '@phosphor-icons/react';
import { useLocale, useTranslations } from 'next-intl';
import { BodyPortal } from '@/components/ui/BodyPortal';
import { Sheet, SheetBody, SheetFooter, SheetHeader } from '@/components/ui/sheet';
import { intlLocale } from '@/lib/format';
import type { DatumSerije } from '@/lib/termini/serija';

export interface VrsticaSerije extends DatumSerije {
  izbrana: boolean;
  /** Shranjevanje tega datuma ni uspelo. */
  napaka?: boolean;
  /** Že shranjen (pri ponovnem poskusu se preskoči). */
  shranjen?: boolean;
  /** "ID termina" shranjenega (za povezavo v serijo). */
  idTermina?: string;
}

interface Props {
  vrstice: VrsticaSerije[];
  onChange: (i: number, sprememba: Partial<VrsticaSerije>) => void;
  onSave: () => void;
  onClose: () => void;
  isSaving: boolean;
  /** Med shranjevanjem: koliko je že shranjenih. */
  napredek?: { n: number; od: number } | null;
}

const inputClass =
  'min-w-0 rounded-[10px] border border-gray-200 bg-white px-2.5 py-2 text-base text-gray-900 focus:border-[#7C78FA] focus:outline-none focus:ring-[3px] focus:ring-[#7C78FA]/25 sm:text-sm';

export function SerijaPregledModal({ vrstice, onChange, onSave, onClose, isSaving, napredek }: Props) {
  const t = useTranslations('appointments.serija');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const zaShranit = vrstice.filter((v) => v.izbrana && !v.shranjen).length;
  const shranjenih = vrstice.filter((v) => v.shranjen).length;
  const dan = (d: string) => {
    const [y, m, dd] = d.split('-').map(Number);
    return new Date(y, m - 1, dd).toLocaleDateString(intlLocale(locale), { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' });
  };

  return (
    <BodyPortal>
      <div className="relative z-[70]">
        <Sheet onClose={isSaving ? () => {} : onClose} maxWidth="sm:max-w-[520px]">
          <SheetHeader
            title={t('reviewTitle')}
            subtitle={t('reviewSubtitle', { count: vrstice.length })}
            onClose={isSaving ? () => {} : onClose}
            closeLabel={tCommon('buttons.close')}
          />
          <SheetBody>
            <ul className="space-y-2">
              {vrstice.map((v, i) => {
                const ikona = v.shranjen ? (
                  <CheckCircle className="h-5 w-5 text-emerald-500" weight="fill" />
                ) : v.napaka || v.stanje === 'tezava' ? (
                  <XCircle className="h-5 w-5 text-red-500" weight="regular" />
                ) : v.stanje === 'premaknjen' ? (
                  <Warning className="h-5 w-5 text-amber-500" weight="regular" />
                ) : (
                  <CheckCircle className="h-5 w-5 text-emerald-500" weight="regular" />
                );
                const opis = v.shranjen
                  ? t('saved')
                  : v.napaka
                  ? t('saveFailed')
                  : v.stanje === 'ok'
                  ? t('free')
                  : v.stanje === 'premaknjen'
                  ? v.razlog === 'zaseden' && v.zasedenZ
                    ? t('movedBusy', { datum: dan(v.zeleno!.datum), ura: v.zeleno!.ura, kdo: v.zasedenZ })
                    : t('movedOff', { datum: dan(v.zeleno!.datum), ura: v.zeleno!.ura })
                  : v.razlog === 'zaseden'
                  ? t('problemBusy')
                  : t('problemOff');
                return (
                  <li key={i} className={`rounded-xl border px-3 py-2.5 ${v.izbrana ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={v.izbrana && !v.shranjen}
                        disabled={isSaving || v.shranjen}
                        onChange={(e) => onChange(i, { izbrana: e.target.checked })}
                        aria-label={t('include', { datum: dan(v.datum) })}
                        className="h-4 w-4 flex-shrink-0 accent-gray-900"
                      />
                      <span className="tnum w-5 flex-shrink-0 text-xs text-gray-400">{i + 1}.</span>
                      <input
                        type="date"
                        value={v.datum}
                        disabled={isSaving || v.shranjen}
                        onChange={(e) => e.target.value && onChange(i, { datum: e.target.value, stanje: 'ok', napaka: false, izbrana: true })}
                        className={`${inputClass} flex-1`}
                      />
                      <input
                        type="time"
                        step={300}
                        value={v.ura}
                        disabled={isSaving || v.shranjen}
                        onChange={(e) => e.target.value && onChange(i, { ura: e.target.value, stanje: 'ok', napaka: false, izbrana: true })}
                        className={`${inputClass} w-[6.5rem] flex-shrink-0`}
                      />
                      <span className="flex-shrink-0">{ikona}</span>
                    </div>
                    <p className="mt-1 pl-[3.25rem] text-xs text-gray-500">{opis}</p>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-gray-500">{t('confirmations', { count: zaShranit })}</p>
          </SheetBody>
          <SheetFooter>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              {shranjenih ? tCommon('buttons.close') : tCommon('buttons.cancel')}
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving || zaShranit === 0}
              className="flex-1 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isSaving && napredek ? t('saving', { n: napredek.n, od: napredek.od }) : t('saveAll', { count: zaShranit })}
            </button>
          </SheetFooter>
        </Sheet>
      </div>
    </BodyPortal>
  );
}

/** Potrditev »Odpovej vse prihodnje«: seznam terminov, ki bodo odpovedani. */
export function SerijaOdpovedModal({
  termini,
  onConfirm,
  onClose,
  isBusy,
}: {
  termini: { datum: string; cas_zacetek: string }[];
  onConfirm: () => void;
  onClose: () => void;
  isBusy: boolean;
}) {
  const t = useTranslations('appointments.serija');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const dan = (d: string) => {
    const [y, m, dd] = d.split('-').map(Number);
    return new Date(y, m - 1, dd).toLocaleDateString(intlLocale(locale), { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' });
  };
  return (
    <BodyPortal>
      <div className="relative z-[70]">
        <Sheet onClose={isBusy ? () => {} : onClose}>
          <SheetHeader title={t('cancelTitle', { count: termini.length })} onClose={isBusy ? () => {} : onClose} closeLabel={tCommon('buttons.close')} />
          <SheetBody>
            <ul className="space-y-1">
              {termini.map((x, i) => (
                <li key={i} className="tnum text-sm text-gray-700">{dan(x.datum)} · {x.cas_zacetek}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-gray-500">{t('cancelHint')}</p>
          </SheetBody>
          <SheetFooter>
            <button
              type="button"
              onClick={onClose}
              disabled={isBusy}
              className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              {tCommon('buttons.back')}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isBusy || termini.length === 0}
              className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {t('cancelConfirm', { count: termini.length })}
            </button>
          </SheetFooter>
        </Sheet>
      </div>
    </BodyPortal>
  );
}
