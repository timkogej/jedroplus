'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  Plus,
  MagnifyingGlass,
  X,
  CalendarBlank,
  UserPlus,
  ArrowRight,
  Warning,
  DownloadSimple,
  UploadSimple,
  CaretDown,
} from '@phosphor-icons/react';
import ProtectedLayout from '@/components/ProtectedLayout';
import { useCompany } from '@/app/company-context';
import { useAuth } from '@/app/auth-context';
import { useRolePermissions } from '@/app/role-permission-context';
import DisabledActionModal from '@/components/DisabledActionModal';
import type { Client, ClientFormData, ClientStats } from '@/types/clients';
import {
  fetchClientsWithCount,
  getClientStats,
} from '@/lib/supabase/clients';
import { callN8nAction } from '@/src/lib/n8nClient';
import {
  buildClientCreateData,
  buildClientDeleteData,
  buildClientUpdateData,
  getPodatkiPodjetja,
} from '@/lib/webhookPayloadBuilders';
import { getNextClientId } from '@/src/lib/idGenerators';
import { getCompanyColumnForTable } from '@/lib/companyScope';
import { TABLES } from '@/lib/data';

// Components
import ClientTable from '@/components/clients/ClientTable';
import ClientModal from '@/components/clients/ClientModal';
import ClientDetailsPanel from '@/components/clients/ClientDetailsPanel';
import DeleteClientModal from '@/components/clients/DeleteClientModal';
import { GradientSpinner } from '@/components/ui/GradientSpinner';

// Stats card component - Gradient border with black icon (no circle)
interface StatCardProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  delay?: number;
}

function StatCard({ icon, value, label, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.1, duration: 0.3 }}
      className="relative overflow-hidden rounded-2xl p-6 bg-white border border-gray-100 shadow-sm"
    >
      {/* FLEX LAYOUT - Icon on right */}
      <div className="flex items-center justify-between">
        {/* Left side - Numbers */}
        <div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: delay * 0.1 + 0.2 }}
            className="text-3xl text-gray-900 mb-1"
          >
            {value}
          </motion.p>
          <p className="text-sm font-medium text-gray-600">{label}</p>
        </div>

        {/* Right side - Icon (black, no circle) */}
        <div className="text-gray-900 flex-shrink-0">
          {icon}
        </div>
      </div>
    </motion.div>
  );
}

// Empty state component
function EmptyState({ onCreateClient }: { onCreateClient: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center rounded-2xl bg-white p-12 shadow-sm ring-1 ring-gray-100"
    >
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
        <Users className="h-10 w-10 text-gray-600" weight="duotone" />
      </div>
      <h3 className="text-xl font-semibold text-[#1A1F36]">Še nimate strank</h3>
      <p className="mt-2 text-center text-sm text-gray-500">
        Začnite z dodajanjem vaše prve stranke za upravljanje terminov in kontaktov.
      </p>
      <motion.button
        type="button"
        onClick={onCreateClient}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="mt-6 flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-6 py-3
                   text-sm font-medium text-white shadow-lg shadow-cyan-500/25 transition-all
                   hover:shadow-xl hover:shadow-cyan-500/30"
      >
        <UserPlus className="h-5 w-5" weight="regular" />
        Dodaj prvo stranko
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
        className="mt-4 flex items-center gap-1.5 text-sm font-medium text-purple-600 hover:text-purple-700"
      >
        Počisti iskanje
        <ArrowRight className="h-4 w-4" weight="regular" />
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
        <CalendarBlank className="h-5 w-5" weight="regular" />
      ) : (
        <Warning className="h-5 w-5" weight="regular" />
      )}
      <span className="text-sm font-medium">{message}</span>
      <button
        type="button"
        onClick={onClose}
        className="ml-2 rounded-full p-0.5 transition-colors hover:bg-white/20"
      >
        <X className="h-4 w-4" weight="regular" />
      </button>
    </motion.div>
  );
}

export default function ClientsPage() {
  const router = useRouter();
  const { companyId, companySettings, loading: companyLoading } = useCompany();
  const { user } = useAuth();
  const { role, permissions } = useRolePermissions();
  const [showDisabledCreateModal, setShowDisabledCreateModal] = useState(false);

  const canCreateClient = role !== 'staff' || (permissions?.can_create_clients ?? true);
  const canViewClient   = role !== 'staff' || (permissions?.can_view_clients ?? true);
  const canEditClient   = role !== 'staff' || (permissions?.can_edit_clients ?? true);
  const canDeleteClient = role !== 'staff' || (permissions?.can_delete_clients ?? true);

  // Data states
  const [clients, setClients] = useState<Client[]>([]);
  const [stats, setStats] = useState<ClientStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search state with debounce
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Details panel state
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsClient, setDetailsClient] = useState<Client | null>(null);

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteClient, setDeleteClient] = useState<Client | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // CRM dropdown states
  const [importDropdownOpen, setImportDropdownOpen] = useState(false);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);

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

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = () => {
      setImportDropdownOpen(false);
      setExportDropdownOpen(false);
    };

    if (importDropdownOpen || exportDropdownOpen) {
      // Delay to prevent immediate closing when opening
      const timer = setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 100);

      return () => {
        clearTimeout(timer);
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [importDropdownOpen, exportDropdownOpen]);

  // Load data
  const loadData = useCallback(async () => {
    if (!companyId) return;

    setIsLoading(true);
    setError(null);

    try {
      const [clientsRes, statsRes] = await Promise.all([
        fetchClientsWithCount(companyId),
        getClientStats(companyId),
      ]);

      if (clientsRes.error) {
        throw clientsRes.error;
      }

      setClients(clientsRes.data ?? []);
      setStats(statsRes.data);
    } catch (err) {
      setError('Prišlo je do napake pri nalaganju podatkov');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter clients by search
  const filteredClients = useMemo(() => {
    if (!debouncedSearch.trim()) return clients;

    const searchLower = debouncedSearch.toLowerCase().trim();
    return clients.filter((client) => {
      const fullName = `${client.ime} ${client.priimek}`.toLowerCase();
      const email = client.email.toLowerCase();
      const phone = (client.telefon || '').toLowerCase();

      return (
        fullName.includes(searchLower) ||
        email.includes(searchLower) ||
        phone.includes(searchLower)
      );
    });
  }, [clients, debouncedSearch]);

  // Show toast
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  }, []);

  // Close modal
  const closeModal = useCallback(() => {
    setModalOpen(false);
    setSelectedClient(null);
  }, []);

  // Open create modal
  const openCreateModal = useCallback(() => {
    setSelectedClient(null);
    setModalMode('create');
    setModalOpen(true);
  }, []);

  // Open edit modal
  const openEditModal = useCallback((client: Client) => {
    setSelectedClient(client);
    setModalMode('edit');
    setModalOpen(true);
    setDetailsOpen(false);
  }, []);

  // Open details panel
  const openDetailsPanel = useCallback((client: Client) => {
    setDetailsClient(client);
    setDetailsOpen(true);
  }, []);

  // Close details panel
  const closeDetailsPanel = useCallback(() => {
    setDetailsOpen(false);
    setDetailsClient(null);
  }, []);

  // Open delete modal
  const openDeleteModal = useCallback((client: Client) => {
    setDeleteClient(client);
    setDeleteModalOpen(true);
    setDetailsOpen(false);
  }, []);

  // Close delete modal
  const closeDeleteModal = useCallback(() => {
    setDeleteModalOpen(false);
    setDeleteClient(null);
  }, []);

  // Save client (create or update)
  const handleSaveClient = useCallback(async (data: ClientFormData) => {
    if (!companyId) return;

    setIsSaving(true);
    try {
      const companyColumn = await getCompanyColumnForTable(TABLES.clients, companyId);

      if (modalMode === 'edit' && selectedClient) {
        // Update existing client
        const updatedRow = {
          id: selectedClient.id,
          Ime: data.ime,
          Priimek: data.priimek,
          Spol: data.spol,
          Email: data.email.trim() || null,
          Telefon: data.telefon.trim() || null,
          Opombe: data.opombe,
          'Interne opombe': data.interne_opombe,
          [companyColumn]: companyId,
        };

        const result = await callN8nAction(
          buildPayload(
            'POSODOBITEV_STRANKE',
            'clients',
            buildClientUpdateData({
              companyId,
              userEmail: actor,
              companyProfile: companyPayload,
              clientRow: updatedRow,
            })
          )
        );

        if (!result.ok) {
          throw new Error('Prišlo je do napake pri posodabljanju stranke');
        }

        showToast('Stranka uspešno posodobljena', 'success');
      } else {
        // Create new client with 7-digit unique ID
        const clientId = await getNextClientId(companyId);
        const newRow = {
          'ID stranke': clientId,
          Ime: data.ime,
          Priimek: data.priimek,
          Spol: data.spol,
          Email: data.email.trim() || null,
          Telefon: data.telefon.trim() || null,
          Opombe: data.opombe,
          'Interne opombe': data.interne_opombe,
          [companyColumn]: companyId,
        };

        const payload = buildPayload(
          'NOVA_STRANKA',
          'clients',
          buildClientCreateData({
            companyId,
            userEmail: actor,
            companyProfile: companyPayload,
            clientRow: newRow,
          })
        );

        const result = await callN8nAction(payload, async () => {
          const nextId = await getNextClientId(companyId);
          return {
            ...payload,
            data: buildClientCreateData({
              companyId,
              userEmail: actor,
              companyProfile: companyPayload,
              clientRow: { ...newRow, 'ID stranke': nextId },
            }),
          };
        });

        if (!result.ok) {
          throw new Error('Prišlo je do napake pri ustvarjanju stranke');
        }

        showToast('Stranka uspešno dodana', 'success');
      }

      // Wait for system to process
      await new Promise((resolve) => setTimeout(resolve, 800));

      closeModal();
      loadData();
    } catch (err) {
      showToast(
        'Prišlo je do napake pri shranjevanju stranke',
        'error'
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    companyId,
    modalMode,
    selectedClient,
    actor,
    companyPayload,
    buildPayload,
    showToast,
    closeModal,
    loadData,
  ]);

  // Delete client
  const handleDeleteClient = useCallback(async () => {
    if (!companyId || !deleteClient) return;

    setIsDeleting(true);
    try {
      const result = await callN8nAction(
        buildPayload(
          'IZBRIS_STRANKE',
          'clients',
          buildClientDeleteData({
            companyId,
            userEmail: actor,
            companyProfile: companyPayload,
            clientId: deleteClient.id,
          })
        )
      );

      if (!result.ok) {
        throw new Error('Prišlo je do napake pri brisanju stranke');
      }

      // Wait for system to process
      await new Promise((resolve) => setTimeout(resolve, 800));

      showToast('Stranka uspešno izbrisana', 'success');
      closeDeleteModal();
      loadData();
    } catch (err) {
      showToast(
        'Prišlo je do napake pri brisanju stranke',
        'error'
      );
    } finally {
      setIsDeleting(false);
    }
  }, [companyId, deleteClient, actor, companyPayload, buildPayload, showToast, closeDeleteModal, loadData]);

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
                className="text-2xl font-normal text-[#1A1F36]"
              >
                Stranke
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="mt-1 text-gray-500"
              >
                Pregledna baza vaših strank
              </motion.p>
            </div>

            <div className="flex items-center gap-3">
              {/* Import CRM Dropdown */}
              <div className="relative">
                <motion.button
                  type="button"
                  onClick={() => {
                    setImportDropdownOpen(!importDropdownOpen);
                    setExportDropdownOpen(false);
                  }}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-2 rounded-xl bg-white border border-gray-200 px-4 py-2.5
                             text-sm font-medium text-gray-700 shadow-sm transition-all
                             hover:bg-gray-50 hover:shadow-md"
                >
                  <DownloadSimple className="h-4 w-4" weight="regular" />
                  <span className="hidden md:inline">Import CRM</span>
                  <CaretDown className={`hidden md:block h-3 w-3 transition-transform ${importDropdownOpen ? 'rotate-180' : ''}`} weight="regular" />
                </motion.button>

                <AnimatePresence>
                  {importDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 5, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 5, scale: 0.95 }}
                      className="absolute right-0 top-full mt-2 w-48 rounded-xl bg-white border border-gray-200 shadow-lg overflow-hidden z-50"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setImportDropdownOpen(false);
                          // TODO: Implement import from CSV
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Uvozi iz CSV
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setImportDropdownOpen(false);
                          // TODO: Implement import from Excel
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Uvozi iz Excel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setImportDropdownOpen(false);
                          // TODO: Implement import from other CRM
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Uvozi iz drugega CRM
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Export CRM Dropdown */}
              <div className="relative">
                <motion.button
                  type="button"
                  onClick={() => {
                    setExportDropdownOpen(!exportDropdownOpen);
                    setImportDropdownOpen(false);
                  }}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-2 rounded-xl bg-white border border-gray-200 px-4 py-2.5
                             text-sm font-medium text-gray-700 shadow-sm transition-all
                             hover:bg-gray-50 hover:shadow-md"
                >
                  <UploadSimple className="h-4 w-4" weight="regular" />
                  <span className="hidden md:inline">Export CRM</span>
                  <CaretDown className={`hidden md:block h-3 w-3 transition-transform ${exportDropdownOpen ? 'rotate-180' : ''}`} weight="regular" />
                </motion.button>

                <AnimatePresence>
                  {exportDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 5, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 5, scale: 0.95 }}
                      className="absolute right-0 top-full mt-2 w-48 rounded-xl bg-white border border-gray-200 shadow-lg overflow-hidden z-50"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setExportDropdownOpen(false);
                          // TODO: Implement export to CSV
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Izvozi v CSV
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setExportDropdownOpen(false);
                          // TODO: Implement export to Excel
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Izvozi v Excel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setExportDropdownOpen(false);
                          // TODO: Implement export to PDF
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Izvozi v PDF
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Nova stranka button */}
              <motion.button
                type="button"
                onClick={canCreateClient ? openCreateModal : () => setShowDisabledCreateModal(true)}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-5 py-2.5
                           text-sm font-medium text-white shadow-lg shadow-cyan-500/25 transition-all
                           hover:shadow-xl hover:shadow-cyan-500/30"
              >
                <Plus className="h-5 w-5 flex-shrink-0" weight="regular" />
                <span className="whitespace-nowrap">Nova stranka</span>
              </motion.button>
            </div>
          </div>

          {/* Stats */}
          {stats && (
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard
                icon={<Users className="h-6 w-6" weight="regular" />}
                value={stats.total}
                label="Skupaj strank"
                delay={0}
              />
              <StatCard
                icon={<CalendarBlank className="h-6 w-6" weight="regular" />}
                value={stats.withAppointments}
                label="S termini"
                delay={1}
              />
              <StatCard
                icon={<UserPlus className="h-6 w-6" weight="regular" />}
                value={stats.newThisMonth}
                label="Novih ta mesec"
                delay={2}
              />
            </div>
          )}

          {/* Search bar */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-6"
          >
            <div className="relative max-w-md">
              <MagnifyingGlass
                className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
                weight="regular"
              />
              <input
                type="text"
                placeholder="Išči stranke po imenu, emailu ali telefonu..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border-0 bg-white py-3 pl-12 pr-12 text-sm text-[#1A1F36]
                           placeholder-gray-400 shadow-sm ring-1 ring-gray-200 transition-all
                           focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1
                             text-gray-400 transition-colors hover:bg-gray-100 hover:text-[#1A1F36]"
                >
                  <X className="h-4 w-4" weight="regular" />
                </button>
              )}
            </div>
            {debouncedSearch && filteredClients.length > 0 && (
              <p className="mt-2 text-sm text-gray-500">
                Prikazujem {filteredClients.length} od {clients.length} strank
              </p>
            )}
          </motion.div>

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
            <ClientTable
              clients={[]}
              onEdit={() => {}}
              onDelete={() => {}}
              onView={() => {}}
              isLoading={true}
            />
          ) : clients.length === 0 ? (
            <EmptyState onCreateClient={openCreateModal} />
          ) : filteredClients.length === 0 && debouncedSearch ? (
            <SearchEmptyState
              searchTerm={debouncedSearch}
              onClear={() => setSearch('')}
            />
          ) : (
            <ClientTable
              clients={filteredClients}
              onEdit={openEditModal}
              onDelete={openDeleteModal}
              onView={openDetailsPanel}
              canViewClient={canViewClient}
              canEditClient={canEditClient}
              canDeleteClient={canDeleteClient}
            />
          )}
        </div>
      </main>

      {/* Create/Edit Modal */}
      <ClientModal
        isOpen={modalOpen}
        onClose={closeModal}
        client={selectedClient}
        mode={modalMode}
        companyId={companyId}
        onSave={handleSaveClient}
        isSaving={isSaving}
      />

      {/* Details Panel */}
      <ClientDetailsPanel
        isOpen={detailsOpen}
        onClose={closeDetailsPanel}
        client={detailsClient}
        companyId={companyId}
        onEdit={openEditModal}
        onDelete={openDeleteModal}
      />

      {/* Delete Modal */}
      <DeleteClientModal
        isOpen={deleteModalOpen}
        onClose={closeDeleteModal}
        client={deleteClient}
        onConfirm={handleDeleteClient}
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
        message="Lastnik podjetja je onemogočil dodajanje novih strank. Obrnite se nanj, da vam to omogoči."
      />
    </ProtectedLayout>
  );
}
