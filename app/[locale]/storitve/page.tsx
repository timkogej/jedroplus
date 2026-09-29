'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useFormat } from '@/hooks/useFormat';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  Briefcase,
  Plus,
  MagnifyingGlass,
  X,
  Clock,
  CurrencyEur,
  ChartLineUp,
  ArrowRight,
  Warning,
  GridFour,
  List,
  CaretDown,
  Palette,
} from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import ProtectedLayout from '@/components/ProtectedLayout';
import { useCompany } from '@/app/company-context';
import { useAuth } from '@/app/auth-context';
import type { Service, ServiceFormData, ServiceStats } from '@/types/services';
import {
  fetchServicesWithCount,
  getServiceStats,
  checkServiceHasAppointments,
} from '@/lib/supabase/services';
import { fetchActiveResursi, fetchStoritveResursi, syncStoritevResursi } from '@/lib/supabase/resursi';
import type { Resurs, StoritevResurs } from '@/types/resursi';
import { callN8nAction } from '@/src/lib/n8nClient';
import {
  buildServiceCreateData,
  buildServiceUpdateData,
  buildServiceDeleteData,
  buildServiceActivityData,
  getPodatkiPodjetja,
} from '@/lib/webhookPayloadBuilders';
import { getNextServiceId } from '@/src/lib/idGenerators';
import { getCompanyColumnForTable } from '@/lib/companyScope';
import { TABLES } from '@/lib/data';
import { hasPosOnlinePaymentsSubscription, isJedroProPlan, parseSettingBool } from '@/lib/onlinePayments';

// Components
import ServiceGrid from '@/components/services/ServiceGrid';
import { MetricGroup } from '@/components/dashboard';
import ServiceModal from '@/components/services/ServiceModal';
import DeleteServiceModal from '@/components/services/DeleteServiceModal';
import { GradientSpinner } from '@/components/ui/GradientSpinner';

// Empty state component
function EmptyState({ onCreateService }: { onCreateService: () => void }) {
  const t = useTranslations('services');
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center rounded-xl border border-gray-100 bg-white p-12"
    >
      <Palette className="mb-3 h-7 w-7 text-gray-300" weight="regular" />
      <h3 className="text-base font-semibold text-gray-900">{t('emptyState.title')}</h3>
      <p className="mt-1 text-center text-sm text-gray-500">
        {t('emptyState.subtitle')}
      </p>
      <button
        type="button"
        onClick={onCreateService}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 active:opacity-80"
      >
        <Plus size={17} weight="bold" />
        {t('emptyState.addFirst')}
      </button>
    </motion.div>
  );
}

// Search empty state
function SearchEmptyState({ searchTerm, onClear }: { searchTerm: string; onClear: () => void }) {
  const t = useTranslations('services');
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center rounded-xl border border-gray-100 bg-white p-12"
    >
      <MagnifyingGlass className="mb-3 h-7 w-7 text-gray-300" weight="regular" />
      <h3 className="text-base font-semibold text-gray-900">
        {t('searchEmpty.title', { term: searchTerm })}
      </h3>
      <p className="mt-1 text-center text-sm text-gray-500">
        {t('searchEmpty.subtitle')}
      </p>
      <button
        type="button"
        onClick={onClear}
        className="mt-4 flex items-center gap-1.5 text-sm font-medium text-[#7C78FA] transition-opacity hover:opacity-70"
      >
        {t('searchEmpty.clear')}
        <ArrowRight className="h-4 w-4" weight="regular" />
      </button>
    </motion.div>
  );
}

// Toast notification component
function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 50, scale: 0.9 }}
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg
                  ${type === 'success'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white'
                    : 'bg-gradient-to-r from-red-500 to-rose-500 text-white'
                  }`}
    >
      {type === 'success' ? (
        <Briefcase className="h-5 w-5" weight="bold" />
      ) : (
        <Warning className="h-5 w-5" weight="bold" />
      )}
      <span className="text-sm font-medium">{message}</span>
      <button
        type="button"
        onClick={onClose}
        className="ml-2 rounded-full p-0.5 transition-colors hover:bg-white/20"
      >
        <X className="h-4 w-4" weight="bold" />
      </button>
    </motion.div>
  );
}

export default function StoritvePage() {
  const { money } = useFormat();
  const router = useRouter();
  const { companyId, companyUuid, companySettings, planCode, loading: companyLoading } = useCompany();
  const { user } = useAuth();
  const t = useTranslations('services');

  // Data states
  const [services, setServices] = useState<Service[]>([]);
  const [stats, setStats] = useState<ServiceStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search and filter state
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showInactive, setShowInactive] = useState(true);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteService, setDeleteService] = useState<Service | null>(null);
  const [deleteAppointmentCount, setDeleteAppointmentCount] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Resursi state for ServiceModal
  const [availableResursi, setAvailableResursi] = useState<Resurs[]>([]);
  const [storitveResursiLinks, setStoritveResursiLinks] = useState<StoritevResurs[]>([]);
  const [pendingResursiIds, setPendingResursiIds] = useState<string[]>([]);
  const [hasPosSubscription, setHasPosSubscription] = useState(false);
  const [isCheckingPosSubscription, setIsCheckingPosSubscription] = useState(false);

  const actor = user?.email ?? 'unknown';
  const companyPayload = useMemo(
    () => getPodatkiPodjetja(companySettings ?? undefined),
    [companySettings]
  );
  const defaultCurrency = useMemo(() => {
    const value =
      companySettings?.default_currency ??
      companySettings?.currency ??
      companySettings?.valuta ??
      companySettings?.Valuta;

    return typeof value === 'string' && value.trim()
      ? value.trim().toUpperCase()
      : 'EUR';
  }, [companySettings]);
  const hasProPlan = useMemo(() => isJedroProPlan(planCode), [planCode]);
  const stripeEnabled = useMemo(
    () => parseSettingBool(companySettings?.stripe_enabled ?? companySettings?.Stripe_enabled, false),
    [companySettings]
  );
  const paymentRequirementAvailable = hasProPlan && hasPosSubscription && stripeEnabled;

  useEffect(() => {
    let cancelled = false;

    async function loadPosSubscription() {
      if (!companyUuid) {
        setHasPosSubscription(false);
        setIsCheckingPosSubscription(false);
        return;
      }

      setIsCheckingPosSubscription(true);
      const hasSubscription = await hasPosOnlinePaymentsSubscription(companyUuid);
      if (!cancelled) {
        setHasPosSubscription(hasSubscription);
        setIsCheckingPosSubscription(false);
      }
    }

    loadPosSubscription();

    return () => {
      cancelled = true;
    };
  }, [companyUuid]);

  const buildPayload = useCallback(
    (event: string, entity: string, data: Record<string, unknown>) => ({
      event,
      entity,
      data,
      company_id: companyId ?? '',
      actor,
      timestamp: new Date().toISOString(),
      meta: { app: 'Integrate' as const, version: '1.0' as const },
    }),
    [companyId, actor]
  );

  // Redirect if no company
  useEffect(() => {
    if (companyLoading) return;
    if (!companyId) {
      router.replace('/onboarding');
    }
  }, [companyId, companyLoading, router]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load data
  const loadData = useCallback(async () => {
    if (!companyId) return;

    setIsLoading(true);
    setError(null);

    try {
      const [servicesRes, statsRes, resursiRes, linksRes] = await Promise.all([
        fetchServicesWithCount(companyId),
        getServiceStats(companyId),
        fetchActiveResursi(companyId),
        fetchStoritveResursi(companyId),
      ]);

      if (servicesRes.error) {
        throw servicesRes.error;
      }

      setServices(servicesRes.data ?? []);
      setStats(statsRes.data);
      if (resursiRes.data) setAvailableResursi(resursiRes.data);
      if (linksRes.data) setStoritveResursiLinks(linksRes.data);
    } catch (err) {
      setError(t('page.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [companyId, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter services by search and active status
  const filteredServices = useMemo(() => {
    let result = services;

    // Filter by active status
    if (!showInactive) {
      result = result.filter((s) => s.aktivna);
    }

    // Filter by search
    if (debouncedSearch.trim()) {
      const searchLower = debouncedSearch.toLowerCase().trim();
      result = result.filter((service) => {
        const name = service.naziv.toLowerCase();
        const description = (service.opis || '').toLowerCase();
        return name.includes(searchLower) || description.includes(searchLower);
      });
    }

    return result;
  }, [services, debouncedSearch, showInactive]);

  // Show toast
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  }, []);

  // Close modal
  const closeModal = useCallback(() => {
    setModalOpen(false);
    setSelectedService(null);
  }, []);

  // Open create modal
  const openCreateModal = useCallback(() => {
    setSelectedService(null);
    setModalMode('create');
    setPendingResursiIds([]);
    setModalOpen(true);
  }, []);

  // Open edit modal
  const openEditModal = useCallback((service: Service) => {
    setSelectedService(service);
    setModalMode('edit');
    const current = storitveResursiLinks
      .filter((l) => l.id_storitve === service.id)
      .map((l) => l.id_resursa);
    setPendingResursiIds(current);
    setModalOpen(true);
  }, [storitveResursiLinks]);

  // Open delete modal
  const openDeleteModal = useCallback(async (service: Service) => {
    if (!companyId) return;

    setDeleteService(service);
    setIsDeleting(true);

    try {
      const result = await checkServiceHasAppointments(companyId, service.id);
      setDeleteAppointmentCount(result.count);
    } catch {
      setDeleteAppointmentCount(service.appointment_count || 0);
    } finally {
      setIsDeleting(false);
      setDeleteModalOpen(true);
    }
  }, [companyId]);

  // Close delete modal
  const closeDeleteModal = useCallback(() => {
    setDeleteModalOpen(false);
    setDeleteService(null);
    setDeleteAppointmentCount(0);
  }, []);

  // Save service (create or update)
  const handleSaveService = useCallback(async (data: ServiceFormData) => {
    if (!companyId) return;

    setIsSaving(true);
    try {
      const companyColumn = await getCompanyColumnForTable(TABLES.services, companyId);
      const zahtevaPlacilo = paymentRequirementAvailable && data.spletne_rezervacije
        ? data.zahteva_placilo
        : false;
      const category = data.kategorija.trim();
      const serviceCurrency = data.currency.trim().toUpperCase() || defaultCurrency;

      if (modalMode === 'edit' && selectedService) {
        // Update existing service
        const updatedRow = {
          id: selectedService.id,
          Naziv: data.naziv,
          Kategorija: category,
          category,
          Barva: data.barva,
          Trajanje: data.trajanje,
          Cena: data.cena ? parseFloat(data.cena) : null,
          Valuta: serviceCurrency,
          valuta: serviceCurrency,
          currency: serviceCurrency,
          Opis: data.opis,
          Spletne_rezervacije: data.spletne_rezervacije,
          zahteva_placilo: zahtevaPlacilo,
          requires_payment: zahtevaPlacilo,
          [companyColumn]: companyId,
        };

        const result = await callN8nAction(
          buildPayload(
            'POSODOBITEV_STORITVE',
            'services',
            buildServiceUpdateData({
              companyId,
              userEmail: actor,
              companyProfile: companyPayload,
              serviceRow: updatedRow,
            })
          )
        );

        if (!result.ok) {
          throw new Error(t('toasts.errorUpdate'));
        }

        await syncStoritevResursi(companyId, selectedService.id, pendingResursiIds);
        showToast(t('toasts.updated'), 'success');
      } else {
        // Create new service
        const serviceId = await getNextServiceId(companyId);
        const newRow = {
          service_id: serviceId,
          Naziv: data.naziv,
          Kategorija: category,
          category,
          Barva: data.barva,
          Trajanje: data.trajanje,
          Cena: data.cena ? parseFloat(data.cena) : null,
          Valuta: serviceCurrency,
          valuta: serviceCurrency,
          currency: serviceCurrency,
          Opis: data.opis,
          Aktivna: true,
          Spletne_rezervacije: data.spletne_rezervacije,
          zahteva_placilo: zahtevaPlacilo,
          requires_payment: zahtevaPlacilo,
          [companyColumn]: companyId,
        };

        // CRITICAL: Fetch ALL company service IDs to send with new service
        const allServiceIds = services.map(s => s.id);
        // Include the new service ID as well
        const allServiceIdsWithNew = [...allServiceIds, serviceId];

        const payload = buildPayload(
          'NOVA_STORITEV',
          'services',
          buildServiceCreateData({
            companyId,
            userEmail: actor,
            companyProfile: companyPayload,
            serviceRow: newRow,
            allServiceIds: allServiceIdsWithNew,
          })
        );

        const result = await callN8nAction(payload, async () => {
          const nextId = await getNextServiceId(companyId);
          return {
            ...payload,
            data: buildServiceCreateData({
              companyId,
              userEmail: actor,
              companyProfile: companyPayload,
              serviceRow: { ...newRow, service_id: nextId },
              allServiceIds: [...allServiceIds, nextId],
            }),
          };
        });

        if (!result.ok) {
          throw new Error(t('toasts.errorCreate'));
        }

        if (pendingResursiIds.length > 0) {
          await syncStoritevResursi(companyId, serviceId, pendingResursiIds);
        }
        showToast(t('toasts.created'), 'success');
      }

      closeModal();
      loadData();
    } catch (err) {
      showToast(t('toasts.errorSave'), 'error');
    } finally {
      setIsSaving(false);
    }
  }, [
    companyId,
    modalMode,
    selectedService,
    actor,
    companyPayload,
    buildPayload,
    showToast,
    closeModal,
    loadData,
    t,
    services,
    pendingResursiIds,
    paymentRequirementAvailable,
    defaultCurrency,
  ]);

  // Toggle service active status
  const handleToggleActive = useCallback(async (service: Service) => {
    if (!companyId) return;

    const newActive = !service.aktivna;

    // Optimistic update — immediately reflect the change in UI
    setServices(prev => prev.map(s => s.id === service.id ? { ...s, aktivna: newActive } : s));

    try {
      const result = await callN8nAction(
        buildPayload(
          newActive ? 'AKTIVACIJA_STORITVE' : 'DEAKTIVACIJA_STORITVE',
          'services',
          buildServiceActivityData({
            companyId,
            userEmail: actor,
            companyProfile: companyPayload,
            serviceId: service.id,
            active: newActive,
          })
        )
      );

      if (!result.ok) {
        setServices(prev => prev.map(s => s.id === service.id ? { ...s, aktivna: service.aktivna } : s));
        throw new Error(t('toasts.errorStatus'));
      }

      showToast(newActive ? t('toasts.activated') : t('toasts.deactivated'), 'success');
    } catch (err) {
      setServices(prev => prev.map(s => s.id === service.id ? { ...s, aktivna: service.aktivna } : s));
      showToast(t('toasts.errorStatus'), 'error');
    }
  }, [companyId, actor, companyPayload, buildPayload, showToast, t]);

  // Delete service
  const handleDeleteService = useCallback(async () => {
    if (!companyId || !deleteService) return;

    setIsDeleting(true);
    try {
      const result = await callN8nAction(
        buildPayload(
          'IZBRIS_STORITVE',
          'services',
          buildServiceDeleteData({
            companyId,
            userEmail: actor,
            companyProfile: companyPayload,
            serviceId: deleteService.id,
          })
        )
      );

      if (!result.ok) {
        throw new Error(t('toasts.errorDelete'));
      }

      showToast(t('toasts.deleted'), 'success');
      closeDeleteModal();
      loadData();
    } catch (err) {
      showToast(t('toasts.errorDelete'), 'error');
    } finally {
      setIsDeleting(false);
    }
  }, [companyId, deleteService, actor, companyPayload, buildPayload, showToast, closeDeleteModal, loadData, t]);


  // Deactivate service (instead of delete when it has appointments)
  const handleDeactivateService = useCallback(async () => {
    if (!deleteService) return;
    await handleToggleActive({ ...deleteService, aktivna: true });
    closeDeleteModal();
  }, [deleteService, handleToggleActive, closeDeleteModal]);

  // Loading state
  if (companyLoading || !companyId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <GradientSpinner />
      </div>
    );
  }

  return (
    <ProtectedLayout>
      <main className="min-h-screen bg-white">
        <div className="mx-auto max-w-7xl px-6 py-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className="mb-7 flex flex-wrap items-start justify-between gap-4"
          >
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">{t('page.title')}</h1>
              <p className="mt-0.5 text-base text-gray-500">{t('page.subtitle')}</p>
            </div>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 active:opacity-80"
            >
              <Plus size={17} weight="bold" />
              {t('page.newButton')}
            </button>
          </motion.div>

          {/* Stats */}
          {stats && (
            <div className="mb-8">
              <MetricGroup
                metrics={[
                  { label: t('stats.total'), value: isLoading ? '—' : stats.total, icon: Briefcase },
                  { label: t('stats.active'), value: isLoading ? '—' : stats.active, icon: ChartLineUp },
                  { label: t('stats.avgDuration'), value: isLoading ? '—' : `${stats.averageDuration} min`, icon: Clock },
                  { label: t('stats.highestPrice'), value: isLoading ? '—' : (stats.highestPrice > 0 ? money(stats.highestPrice) : '-'), icon: CurrencyEur },
                ]}
              />
            </div>
          )}

          {/* Search and filters bar */}
          <div className="mb-6 flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative min-w-[260px] max-w-md flex-1">
              <MagnifyingGlass
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                weight="regular"
              />
              <input
                type="text"
                placeholder={t('page.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-10 text-sm text-gray-900
                           placeholder-gray-400 transition-colors
                           focus:border-[#7C78FA] focus:outline-none focus:ring-[3px] focus:ring-[#7C78FA]/25"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1
                             text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
                >
                  <X className="h-4 w-4" weight="regular" />
                </button>
              )}
            </div>

            {/* Show inactive toggle */}
            <button
              type="button"
              onClick={() => setShowInactive(!showInactive)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                showInactive
                  ? 'border border-gray-200 bg-white text-gray-900 hover:bg-gray-50'
                  : 'border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100'
              }`}
            >
              {showInactive ? t('page.showAll') : t('page.showActiveOnly')}
              <CaretDown className={`h-3.5 w-3.5 transition-transform ${showInactive ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Results count */}
          {debouncedSearch && filteredServices.length > 0 && (
            <p className="mb-4 text-sm text-gray-500">
              {t('page.resultsCount', { current: filteredServices.length, total: services.length })}
            </p>
          )}

          {/* Error state */}
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-6 flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-4"
            >
              <Warning className="h-5 w-5 flex-shrink-0 text-red-500" weight="regular" />
              <p className="text-sm font-medium text-red-700">{error}</p>
              <button
                type="button"
                onClick={loadData}
                className="ml-auto text-sm font-medium text-red-600 hover:text-red-700"
              >
                {t('page.retry')}
              </button>
            </motion.div>
          )}

          {/* Content */}
          {isLoading ? (
            <ServiceGrid
              services={[]}
              onEdit={() => {}}
              onDelete={() => {}}
              onToggleActive={() => {}}
              isLoading={true}
            />
          ) : services.length === 0 ? (
            <EmptyState onCreateService={openCreateModal} />
          ) : filteredServices.length === 0 && debouncedSearch ? (
            <SearchEmptyState
              searchTerm={debouncedSearch}
              onClear={() => setSearch('')}
            />
          ) : (
            <ServiceGrid
              services={filteredServices}
              onEdit={openEditModal}
              onDelete={openDeleteModal}
              onToggleActive={handleToggleActive}
            />
          )}
        </div>
      </main>

      {/* Create/Edit Modal */}
      <ServiceModal
        isOpen={modalOpen}
        onClose={closeModal}
        service={selectedService}
        mode={modalMode}
        onSave={handleSaveService}
        isSaving={isSaving}
        currency={defaultCurrency}
        existingCategories={[...new Set(services.map(s => s.kategorija).filter((c): c is string => Boolean(c)))]}
        availableResursi={availableResursi}
        linkedResursiIds={pendingResursiIds}
        onLinkedResursiChange={setPendingResursiIds}
        paymentRequirementAvailable={paymentRequirementAvailable}
        paymentRequirementChecks={{
          hasProPlan,
          hasPosSubscription,
          stripeEnabled,
          loading: isCheckingPosSubscription,
        }}
      />

      {/* Delete Modal */}
      <DeleteServiceModal
        isOpen={deleteModalOpen}
        onClose={closeDeleteModal}
        service={deleteService}
        appointmentCount={deleteAppointmentCount}
        onConfirm={handleDeleteService}
        onDeactivate={handleDeactivateService}
        isDeleting={isDeleting}
      />

      {/* Toast notifications */}
      <AnimatePresence>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </AnimatePresence>
    </ProtectedLayout>
  );
}
