'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, SpinnerGap, CheckCircle } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Select, SelectOption } from '@/components/ui/animated-select';
import { useCompany } from '@/app/company-context';
import { fetchServices, fetchEmployees } from '@/lib/supabase/appointments';
import { fetchCompanySlug, type ZahtevaTermina } from '@/lib/supabase/zahteveTermini';
import { requestSlots, confirmRequest, type SlotAvailability } from '@/lib/bookingRequests';
import type { Storitev, Zaposleni } from '@/types/appointments';

interface ConfirmRequestModalProps {
  zahteva: ZahtevaTermina;
  onClose: () => void;
  onConfirmed: () => void;
}

type Step = 'assign' | 'slot';

export function ConfirmRequestModal({ zahteva, onClose, onConfirmed }: ConfirmRequestModalProps) {
  const t = useTranslations('zahteve-termini');
  const { companyId } = useCompany();

  const [services, setServices] = useState<Storitev[]>([]);
  const [employees, setEmployees] = useState<(Zaposleni & { initials: string })[]>([]);
  const [companySlug, setCompanySlug] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  const [serviceId, setServiceId] = useState('');
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
      setServices(servicesRes.data ?? []);
      setEmployees(employeesRes.data ?? []);
      setCompanySlug(slug);
      setLoadingData(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const availableEmployees = useMemo(() => {
    if (!serviceId) return employees;
    return employees.filter((e) => !e.storitve || e.storitve.length === 0 || e.storitve.includes(serviceId));
  }, [employees, serviceId]);

  useEffect(() => {
    if (employeeId && !availableEmployees.some((e) => e.id === employeeId)) {
      setEmployeeId('');
    }
  }, [availableEmployees, employeeId]);

  const loadSlots = async () => {
    if (!companySlug || !employeeId || !serviceId) return;
    setStep('slot');
    setLoadingSlots(true);
    setSlotsError(false);
    setSelectedDate(null);
    setSelectedTime(null);
    try {
      const result = await requestSlots({
        companySlug,
        employeeId,
        serviceIds: [serviceId],
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
        serviceIds: [serviceId],
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

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative flex w-full max-w-lg max-h-[85vh] flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{t('confirmModal.title')}</h2>
              <p className="mt-0.5 text-sm text-gray-500">{t('confirmModal.subtitle')}</p>
            </div>
            <button onClick={onClose} className="rounded-lg p-2 transition-colors hover:bg-gray-100">
              <X className="h-4 w-4 text-gray-500" weight="bold" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {loadingData ? (
              <div className="flex items-center justify-center py-10">
                <SpinnerGap className="h-5 w-5 animate-spin text-gray-400" weight="bold" />
              </div>
            ) : step === 'assign' ? (
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    {t('confirmModal.serviceLabel')}
                  </label>
                  <Select value={serviceId} setValue={setServiceId} placeholder={t('confirmModal.servicePlaceholder')}>
                    {services.map((service) => (
                      <SelectOption key={service.id} value={service.id}>
                        {service.naziv}
                      </SelectOption>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    {t('confirmModal.employeeLabel')}
                  </label>
                  <Select
                    value={employeeId}
                    setValue={setEmployeeId}
                    placeholder={t('confirmModal.employeePlaceholder')}
                    disabled={!serviceId}
                  >
                    {availableEmployees.map((employee) => (
                      <SelectOption key={employee.id} value={employee.id}>
                        {employee.ime} {employee.priimek}
                      </SelectOption>
                    ))}
                  </Select>
                </div>
              </div>
            ) : (
              <div>
                {loadingSlots ? (
                  <div className="flex flex-col items-center gap-2 py-10 text-sm text-gray-500">
                    <SpinnerGap className="h-5 w-5 animate-spin" weight="bold" />
                    {t('confirmModal.loadingSlots')}
                  </div>
                ) : slotsError ? (
                  <p className="py-10 text-center text-sm text-red-500">{t('confirmModal.slotsError')}</p>
                ) : dateEntries.length === 0 ? (
                  <p className="py-10 text-center text-sm text-gray-500">{t('confirmModal.noSlots')}</p>
                ) : (
                  <div className="space-y-4">
                    {dateEntries.map(([date, times]) => (
                      <div key={date}>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                          {date}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {times.map((time) => {
                            const isSelected = selectedDate === date && selectedTime === time;
                            return (
                              <button
                                key={time}
                                onClick={() => {
                                  setSelectedDate(date);
                                  setSelectedTime(time);
                                }}
                                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                                  isSelected
                                    ? 'border-violet-500 bg-violet-500 text-white'
                                    : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
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

          <div className="flex flex-shrink-0 justify-end gap-3 border-t border-gray-100 px-5 py-4">
            {step === 'slot' && (
              <button
                onClick={() => setStep('assign')}
                className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
              >
                {t('confirmModal.back')}
              </button>
            )}
            {step === 'assign' ? (
              <button
                onClick={loadSlots}
                disabled={!serviceId || !employeeId || !companySlug}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t('confirmModal.next')}
              </button>
            ) : (
              <button
                onClick={handleConfirm}
                disabled={!selectedDate || !selectedTime || confirming}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
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
  );
}
