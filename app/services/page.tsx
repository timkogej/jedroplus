'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
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
  Folder,
} from '@phosphor-icons/react';
import ProtectedLayout from '@/components/ProtectedLayout';
import { useCompany } from '@/app/company-context';
import { useAuth } from '@/app/auth-context';
import { useRolePermissions } from '@/app/role-permission-context';
import DisabledActionModal from '@/components/DisabledActionModal';
import { supabase as supabaseClient } from '@/lib/supabaseClient';
import type { Service, ServiceFormData, ServiceStats } from '@/types/services';
import {
  fetchServicesWithCount,
  getServiceStats,
  checkServiceHasAppointments,
  fetchUniqueCategories,
} from '@/lib/supabase/services';
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

// Components
import ServiceGrid from '@/components/services/ServiceGrid';
import ServiceModal from '@/components/services/ServiceModal';
import DeleteServiceModal from '@/components/services/DeleteServiceModal';
import { Select, SelectOption } from '@/components/ui/animated-select';
import { GradientSpinner } from '@/components/ui/GradientSpinner';

// Stats card component - no icon circles, icons on right side
interface StatCardProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  delay?: number;
}

function StatCard({ icon, value, label, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.1, duration: 0.3 }}
      className="group relative rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 transition-all
                 hover:shadow-md hover:ring-gray-200"
    >
      <div className="flex items-center justify-between">
        <div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: delay * 0.1 + 0.2 }}
            className="text-3xl font-bold text-gray-900 mb-1"
          >
            {value}
          </motion.p>
          <p className="text-sm font-medium text-gray-600">{label}</p>
        </div>
        <div className="text-black flex-shrink-0">
          {icon}
        </div>
      </div>
    </motion.div>
  );
}

// Empty state component
function EmptyState({ onCreateService }: { onCreateService: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center rounded-2xl bg-white p-12 shadow-sm ring-1 ring-gray-100"
    >
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-violet-100">
        <Palette className="h-10 w-10 text-violet-500" weight="duotone" />
      </div>
      <h3 className="text-xl font-semibold text-[#1A1F36]">Še nimate dodanih storitev</h3>
      <p className="mt-2 text-center text-sm text-gray-500">
        Začnite z dodajanjem vaše prve storitve za upravljanje terminov.
      </p>
      <motion.button
        type="button"
        onClick={onCreateService}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="mt-6 flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-6 py-3
                   text-sm font-medium text-white shadow-lg shadow-cyan-500/25 transition-all
                   hover:shadow-xl hover:shadow-cyan-500/30"
      >
        <Plus className="h-5 w-5" weight="bold" />
        Dodaj prvo storitev
      </motion.button>
    </motion.div>
  );
}

// Search empty state
function SearchEmptyState({ searchTerm, onClear }: { searchTerm: string; onClear: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center rounded-2xl bg-white p-12 shadow-sm ring-1 ring-gray-100"
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-gray-100 to-slate-100">
        <MagnifyingGlass className="h-8 w-8 text-gray-400" weight="duotone" />
      </div>
      <h3 className="text-lg font-semibold text-[#1A1F36]">
        Ni rezultatov za &quot;{searchTerm}&quot;
      </h3>
      <p className="mt-2 text-center text-sm text-gray-500">
        Poskusite z drugim iskanjem ali počistite filter
      </p>
      <motion.button
        type="button"
        onClick={onClear}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="mt-4 flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:text-violet-700"
      >
        Počisti iskanje
        <ArrowRight className="h-4 w-4" weight="bold" />
      </motion.button>
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
  const router = useRouter();
  const { companyId, companySettings, loading: companyLoading } = useCompany();
  const { user } = useAuth();
  const { role, personId: rolePersonId, permissions } = useRolePermissions();
  const [showDisabledCreateModal, setShowDisabledCreateModal] = useState(false);
  const [staffAllowedServiceIds, setStaffAllowedServiceIds] = useState<string[] | null>(null);

  const canViewAllServices  = role !== 'staff' || (permissions?.can_view_services ?? true);
  const canEditService      = role !== 'staff' || (permissions?.can_edit_services ?? true);
  const canDeleteService    = role !== 'staff' || (permissions?.can_delete_services ?? true);
  const canCreateService    = role !== 'staff' || (permissions?.can_create_services ?? true);

  // Data states
  const [services, setServices] = useState<Service[]>([]);
  const [stats, setStats] = useState<ServiceStats | null>(null);
  const [categories, setCategories] = useState<string[]>([]); // Dynamic categories from database
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search and filter state
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
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

  const actor = user?.email ?? 'unknown';
  const companyPayload = useMemo(
    () => getPodatkiPodjetja(companySettings ?? undefined),
    [companySettings]
  );

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

  // Fetch staff's allowed service IDs when can_view_services = false
  useEffect(() => {
    if (canViewAllServices || !rolePersonId) {
      setStaffAllowedServiceIds(null);
      return;
    }
    supabaseClient
      .from('Osebje')
      .select('storitve')
      .eq('id', rolePersonId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data?.storitve) {
          setStaffAllowedServiceIds([]);
          return;
        }
        const ids: string[] = Array.isArray(data.storitve)
          ? data.storitve.map(String)
          : [];
        setStaffAllowedServiceIds(ids);
      });
  }, [canViewAllServices, rolePersonId]);

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
      const [servicesRes, statsRes, categoriesRes] = await Promise.all([
        fetchServicesWithCount(companyId),
        getServiceStats(companyId),
        fetchUniqueCategories(companyId),
      ]);

      if (servicesRes.error) {
        throw servicesRes.error;
      }

      setServices(servicesRes.data ?? []);
      setStats(statsRes.data);
      setCategories(categoriesRes.data ?? []);
    } catch (err) {
      setError('Prišlo je do napake pri nalaganju podatkov');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter services by search, category and active status
  const filteredServices = useMemo(() => {
    let result = services;

    // Staff view restriction: only show services the employee is assigned to
    if (staffAllowedServiceIds !== null) {
      result = result.filter((s) => staffAllowedServiceIds.includes(String(s.id)));
    }

    // Filter by active status
    if (!showInactive) {
      result = result.filter((s) => s.aktivna);
    }

    // Filter by category
    if (selectedCategory) {
      result = result.filter((s) => s.kategorija === selectedCategory);
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
  }, [services, debouncedSearch, selectedCategory, showInactive, staffAllowedServiceIds]);

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
    setModalOpen(true);
  }, []);

  // Open edit modal
  const openEditModal = useCallback((service: Service) => {
    setSelectedService(service);
    setModalMode('edit');
    setModalOpen(true);
  }, []);

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

      // Calculate total time (skupni_cas)
      const skupniCas = data.trajanje + data.buffer_pred + data.buffer_po;
      // Get currency from company settings
      const valuta = companySettings?.valuta || companySettings?.currency || 'EUR';

      if (modalMode === 'edit' && selectedService) {
        // Update existing service
        const updatedRow = {
          id: selectedService.id,
          Naziv: data.naziv,
          Kategorija: data.kategorija || null,
          Barva: data.barva,
          Trajanje: data.trajanje,
          buffer_pred: data.buffer_pred,
          buffer_po: data.buffer_po,
          skupni_cas: skupniCas,
          tip_cene: data.tip_cene,
          Cena: data.cena ? parseFloat(data.cena) : null,
          valuta: valuta,
          Opis: data.opis,
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
          throw new Error('Prišlo je do napake pri posodabljanju storitve');
        }

        showToast('Storitev uspešno posodobljena', 'success');
      } else {
        // Create new service with 7-digit unique ID
        const serviceId = await getNextServiceId(companyId);
        const newRow = {
          'ID storitve': serviceId,
          Naziv: data.naziv,
          Kategorija: data.kategorija || null,
          Barva: data.barva,
          Trajanje: data.trajanje,
          buffer_pred: data.buffer_pred,
          buffer_po: data.buffer_po,
          skupni_cas: skupniCas,
          tip_cene: data.tip_cene,
          Cena: data.cena ? parseFloat(data.cena) : null,
          valuta: valuta,
          Opis: data.opis,
          Aktivna: true,
          [companyColumn]: companyId,
        };

        const payload = buildPayload(
          'NOVA_STORITEV',
          'services',
          buildServiceCreateData({
            companyId,
            userEmail: actor,
            companyProfile: companyPayload,
            serviceRow: newRow,
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
              serviceRow: { ...newRow, 'ID storitve': nextId },
            }),
          };
        });

        if (!result.ok) {
          throw new Error('Prišlo je do napake pri ustvarjanju storitve');
        }

        showToast('Storitev uspešno dodana', 'success');
      }

      // Wait 1 second for system to process
      await new Promise((resolve) => setTimeout(resolve, 1000));

      closeModal();
      loadData();
    } catch (err) {
      showToast(
        'Prišlo je do napake pri shranjevanju storitve',
        'error'
      );
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
  ]);

  // Toggle service active status
  const handleToggleActive = useCallback(async (service: Service) => {
    if (!companyId) return;

    try {
      const result = await callN8nAction(
        buildPayload(
          service.aktivna ? 'DEAKTIVACIJA_STORITVE' : 'AKTIVACIJA_STORITVE',
          'services',
          buildServiceActivityData({
            companyId,
            userEmail: actor,
            companyProfile: companyPayload,
            serviceId: service.id,
            active: !service.aktivna,
          })
        )
      );

      if (!result.ok) {
        throw new Error('Prišlo je do napake pri spremembi statusa');
      }

      showToast(
        service.aktivna ? 'Storitev deaktivirana' : 'Storitev aktivirana',
        'success'
      );
      loadData();
    } catch (err) {
      showToast(
        'Prišlo je do napake pri spremembi statusa',
        'error'
      );
    }
  }, [companyId, actor, companyPayload, buildPayload, showToast, loadData]);

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
        throw new Error('Prišlo je do napake pri brisanju storitve');
      }

      // Wait 1 second for system to process
      await new Promise((resolve) => setTimeout(resolve, 1000));

      showToast('Storitev uspešno izbrisana', 'success');
      closeDeleteModal();
      loadData();
    } catch (err) {
      showToast(
        'Prišlo je do napake pri brisanju storitve',
        'error'
      );
    } finally {
      setIsDeleting(false);
    }
  }, [companyId, deleteService, actor, companyPayload, buildPayload, showToast, closeDeleteModal, loadData]);

  // Deactivate service (instead of delete when it has appointments)
  const handleDeactivateService = useCallback(async () => {
    if (!deleteService) return;
    await handleToggleActive({ ...deleteService, aktivna: true });
    closeDeleteModal();
  }, [deleteService, handleToggleActive, closeDeleteModal]);

  // Loading state - white background with simple black spinner
  if (companyLoading || !companyId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <GradientSpinner />
      </div>
    );
  }

  return (
    <ProtectedLayout>
      <main className="min-h-screen bg-[#F7F8FA]">
        <div className="mx-auto max-w-7xl px-6 py-8">
          {/* Header */}
          <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div>
              <motion.h1
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-3xl font-bold text-[#1A1F36]"
              >
                Storitve
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="mt-1 text-gray-500"
              >
                Upravljanje storitev
              </motion.p>
            </div>
            <motion.button
              type="button"
              onClick={canCreateService ? openCreateModal : () => setShowDisabledCreateModal(true)}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-5 py-3
                         text-sm font-medium text-white shadow-lg shadow-cyan-500/25 transition-all
                         hover:shadow-xl hover:shadow-cyan-500/30"
            >
              <Plus className="h-5 w-5" weight="bold" />
              Nova storitev
            </motion.button>
          </div>

          {/* Stats */}
          {stats && (
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={<Briefcase className="h-7 w-7" weight="bold" />}
                value={stats.total}
                label="Skupaj storitev"
                delay={0}
              />
              <StatCard
                icon={<ChartLineUp className="h-7 w-7" weight="bold" />}
                value={stats.active}
                label="Aktivnih storitev"
                delay={1}
              />
              <StatCard
                icon={<Clock className="h-7 w-7" weight="bold" />}
                value={`${stats.averageDuration} min`}
                label="Povprečno trajanje"
                delay={2}
              />
              <StatCard
                icon={<CurrencyEur className="h-7 w-7" weight="bold" />}
                value={stats.highestPrice > 0 ? `€${stats.highestPrice.toFixed(2)}` : '-'}
                label="Najdražja storitev"
                delay={3}
              />
            </div>
          )}

          {/* Search and filters bar */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-6 flex flex-wrap items-center gap-4"
          >
            {/* Search */}
            <div className="relative flex-1 min-w-[280px] max-w-md">
              <MagnifyingGlass
                className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
                weight="bold"
              />
              <input
                type="text"
                placeholder="Išči storitve po nazivu..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border-0 bg-white py-3 pl-12 pr-12 text-sm text-[#1A1F36]
                           placeholder-gray-400 shadow-sm ring-1 ring-gray-200 transition-all
                           focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1
                             text-gray-400 transition-colors hover:bg-gray-100 hover:text-[#1A1F36]"
                >
                  <X className="h-4 w-4" weight="bold" />
                </button>
              )}
            </div>

            {/* Category filter - Using animated select like Termini page */}
            <div className="w-48">
              <Select
                value={selectedCategory}
                setValue={setSelectedCategory}
                placeholder="Vse kategorije"
              >
                <SelectOption value="">Vse kategorije</SelectOption>
                {categories.map((category) => (
                  <SelectOption key={category} value={category}>
                    {category}
                  </SelectOption>
                ))}
              </Select>
            </div>

            {/* Show inactive toggle */}
            <motion.button
              type="button"
              onClick={() => setShowInactive(!showInactive)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-all
                         ${!showInactive
                           ? 'bg-violet-100 text-violet-700 ring-1 ring-violet-200'
                           : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
                         }`}
            >
              {showInactive ? 'Vse storitve' : 'Samo aktivne'}
              <CaretDown className={`h-4 w-4 transition-transform ${showInactive ? 'rotate-180' : ''}`} />
            </motion.button>
          </motion.div>

          {/* Results count */}
          {debouncedSearch && filteredServices.length > 0 && (
            <p className="mb-4 text-sm text-gray-500">
              Prikazujem {filteredServices.length} od {services.length} storitev
            </p>
          )}

          {/* Error state */}
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-6 flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3"
            >
              <Warning className="h-5 w-5 flex-shrink-0 text-red-500" weight="fill" />
              <p className="text-sm text-red-700">{error}</p>
              <button
                type="button"
                onClick={loadData}
                className="ml-auto text-sm font-medium text-red-600 hover:text-red-700"
              >
                Poskusi znova
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
              canEdit={canEditService}
              canDelete={canDeleteService}
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
        existingCategories={categories}
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

      <DisabledActionModal
        isOpen={showDisabledCreateModal}
        onClose={() => setShowDisabledCreateModal(false)}
        message="Lastnik podjetja je onemogočil dodajanje novih storitev. Obrnite se nanj, da vam to omogoči."
      />
    </ProtectedLayout>
  );
}
