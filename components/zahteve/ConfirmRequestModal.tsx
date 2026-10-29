'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, SpinnerGap, CheckCircle } from '@phosphor-icons/react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Select, SelectOption } from '@/components/ui/animated-select';
import { useCompany } from '@/app/company-context';
import { fetchServices, fetchEmployees } from '@/lib/supabase/appointments';
import { fetchCompanySlug, type ZahtevaTermina } from '@/lib/supabase/zahteveTermini';
import { requestSlots, confirmRequest, type SlotAvailability } from '@/lib/bookingRequests';
import type { Storitev, Zaposleni } from '@/types/appointments';
import { sheet } from '@/components/ui/sheetClasses';
import { useSheetDrag } from '@/components/ui/useSheetDrag';
import { BodyPortal } from '@/components/ui/BodyPortal';
import { RequestSummary } from './RequestSummary';
import { formatRequestDay } from './format';

/** Same limit as the booking page. */
const MAX_SERVICES = 3;

interface ConfirmRequestModalProps {
  zahteva: ZahtevaTermina;
  onClose: () => void;
  onConfirmed: () => void;
}

type Step = 'assign' | 'slot';

export function ConfirmRequestModal({ zahteva, onClose, onConfirmed }: ConfirmRequestModalProps) {
  const sheetDrag = useSheetDrag(onClose);
  const t = useTranslations('zahteve-termini');
  const locale = useLocale();
  const { companyId } = useCompany();

  const [services, setServices] = useState<Storitev[]>([]);
  const [employees, setEmployees] = useState<(Zaposleni & { initials: string })[]>([]);
  const [companySlug, setCompanySlug] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [step, setStep] = useState<Step>('assign');

  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState(false);
  const [slots, setSlots] = useState<Record<string, SlotAvailability>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    (async () => {
      setLoadingData(true);
      const [servicesRes, employeesRes, slug] = await Promise.all([
        fetchServices(companyId),
        fetchEmployees(companyId),
        fetchCompanySlug(companyId),
      ]);
      if (cancelled) return;
      const loadedServices = servicesRes.data ?? [];
      const loadedEmployees = employeesRes.data ?? [];
      setServices(loadedServices);
      setEmployees(loadedEmployees);
      setCompanySlug(slug);
      // Start from what the client chose on the booking page.
      const wanted = zahteva.storitve_ids.filter((id) => loadedServices.some((sv) => sv.id === id));
      setServiceIds(wanted.slice(0, MAX_SERVICES));
      if (zahteva.zeljeni_zaposleni_id && loadedEmployees.some((e) => e.id === zahteva.zeljeni_zaposleni_id)) {
        setEmployeeId(zahteva.zeljeni_zaposleni_id);
      }
      setLoadingData(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, zahteva.storitve_ids, zahteva.zeljeni_zaposleni_id]);

  // People who do every chosen service.
  const availableEmployees = useMemo(() => {
    if (serviceIds.length === 0) return employees;
    return employees.filter(
      (e) => !e.storitve || e.storitve.length === 0 || serviceIds.every((id) => e.storitve!.includes(id)),
    );
  }, [employees, serviceIds]);

  useEffect(() => {
    if (employeeId && !availableEmployees.some((e) => e.id === employeeId)) {
      setEmployeeId('');
    }
  }, [availableEmployees, employeeId]);

  const loadSlots = async () => {
    if (!companySlug || !employeeId || serviceIds.length === 0) return;
    setStep('slot');
    setLoadingSlots(true);
    setSlotsError(false);
    setSelectedDate(null);
    setSelectedTime(null);
    try {
      const result = await requestSlots({
        companySlug,
        employeeId,
        serviceIds,
        dateFrom: zahteva.zeljeni_datum_od,
        dateTo: zahteva.zeljeni_datum_do,
        delDneva: zahteva.zeljeni_del_dneva,
      });
      if (!result.success || !result.slots) {
        setSlotsError(true);
        return;
      }
      setSlots(result.slots);
    } catch {
      setSlotsError(true);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedDate || !selectedTime) return;
    setConfirming(true);
    try {
      const result = await confirmRequest({
        requestId: zahteva.id,
        employeeId,
        serviceIds,
        date: selectedDate,
        time: selectedTime,
      });
      if (!result.success) {
        toast.error(t('confirmModal.error'));
        return;
      }
      toast.success(t('confirmModal.success'));
      onConfirmed();
    } catch {
      toast.error(t('confirmModal.error'));
    } finally {
      setConfirming(false);
    }
  };

  const dateEntries = Object.entries(slots).filter(
    ([, value]) => Array.isArray(value) && value.length > 0
  ) as [string, string[]][];

  const labelClass = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-500';

  return (
    <BodyPortal>
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={sheet.backdrop}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          {...sheetDrag.panel}
          className={`${sheet.panel} sm:max-w-lg`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={sheet.header} {...sheetDrag.handle}>
            <div className={sheet.grabber} aria-hidden="true" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className={sheet.title}>{t('confirmModal.title')}</h2>
                <p className={sheet.subtitle}>{t('confirmModal.subtitle')}</p>
              </div>
              <button onClick={onClose} className={sheet.close}>
                <X className="h-5 w-5" weight="regular" />
              </button>
            </div>
          </div>

          <div className={sheet.body}>
            <RequestSummary zahteva={zahteva} />

            {loadingData ? (
              <div className="flex items-center justify-center py-10">
                <SpinnerGap className="h-5 w-5 animate-spin text-gray-400" weight="bold" />
              </div>
            ) : step === 'assign' ? (
              <div className={`${sheet.group} space-y-4`}>
                <div>
                  <label className={labelClass}>
                    {t('confirmModal.serviceLabel')}
                  </label>
                  {serviceIds.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {serviceIds.map((id) => (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 py-1 pl-3 pr-1.5 text-sm font-medium text-violet-700"
                        >
                          {services.find((sv) => sv.id === id)?.naziv ?? id}
                          <button
                            type="button"
                            aria-label={t('confirmModal.removeService')}
                            onClick={() => setServiceIds((ids) => ids.filter((x) => x !== id))}
                            className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-violet-100"
                          >
                            <X className="h-3 w-3" weight="bold" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {serviceIds.length < MAX_SERVICES && (
                    <Select
                      value=""
                      setValue={(id) => id && setServiceIds((ids) => (ids.includes(id) ? ids : [...ids, id]))}
                      placeholder={serviceIds.length === 0 ? t('confirmModal.servicePlaceholder') : t('confirmModal.addService')}
                    >
                      {services
                        .filter((service) => !serviceIds.includes(service.id))
                        .map((service) => (
                          <SelectOption key={service.id} value={service.id}>
                            {service.naziv}
                          </SelectOption>
                        ))}
                    </Select>
                  )}
                  {!zahteva.storitve && (
                    <p className="mt-1.5 text-xs text-amber-700">{t('confirmModal.clientUnsure')}</p>
                  )}
                </div>

                <div>
                  <label className={labelClass}>
                    {t('confirmModal.employeeLabel')}
                  </label>
                  <Select
                    value={employeeId}
                    setValue={setEmployeeId}
                    placeholder={t('confirmModal.employeePlaceholder')}
                    disabled={serviceIds.length === 0}
                  >
                    {availableEmployees.map((employee) => (
                      <SelectOption key={employee.id} value={employee.id}>
                        {employee.ime} {employee.priimek}
                      </SelectOption>
                    ))}
                  </Select>
                  {zahteva.zeljeni_zaposleni && (
                    <p className="mt-1.5 text-xs text-gray-500">
                      {t('confirmModal.clientWants', { name: zahteva.zeljeni_zaposleni })}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className={sheet.group}>
                {loadingSlots ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-sm text-gray-500">
                    <SpinnerGap className="h-5 w-5 animate-spin" weight="bold" />
                    {t('confirmModal.loadingSlots')}
                  </div>
                ) : slotsError ? (
                  <p className="py-8 text-center text-sm text-red-500">{t('confirmModal.slotsError')}</p>
                ) : dateEntries.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-500">{t('confirmModal.noSlots')}</p>
                ) : (
                  <div className="space-y-4">
                    {dateEntries.map(([date, times]) => (
                      <div key={date}>
                        <p className={`${labelClass} tnum`}>
                          {formatRequestDay(date, locale)}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {times.map((time) => {
                            const isSelected = selectedDate === date && selectedTime === time;
                            return (
                              <button
                                key={time}
                                onClick={() => {
                                  setSelectedDate(date);
                                  setSelectedTime(time);
                                }}
                                className={`tnum rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                                  isSelected
                                    ? 'bg-violet-500 text-white'
                                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                                }`}
                              >
                                {time}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className={sheet.footer}>
            {step === 'slot' && (
              <button
                onClick={() => setStep('assign')}
                className={sheet.cancel}
              >
                {t('confirmModal.back')}
              </button>
            )}
            {step === 'assign' ? (
              <button
                onClick={loadSlots}
                disabled={serviceIds.length === 0 || !employeeId || !companySlug}
                className={`${sheet.action} bg-gradient-to-r from-violet-500 to-cyan-500 disabled:cursor-not-allowed disabled:opacity-40`}
              >
                {t('confirmModal.next')}
              </button>
            ) : (
              <button
                onClick={handleConfirm}
                disabled={!selectedDate || !selectedTime || confirming}
                className={`${sheet.action} bg-gradient-to-r from-violet-500 to-cyan-500 disabled:cursor-not-allowed disabled:opacity-40`}
              >
                {confirming ? (
                  <>
                    <SpinnerGap className="h-4 w-4 animate-spin" weight="bold" />
                    {t('confirmModal.confirming')}
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" weight="bold" />
                    {t('confirmModal.confirmButton')}
                  </>
                )}
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
    </BodyPortal>
  );
}
