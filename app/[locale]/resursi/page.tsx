'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  Cube,
  Plus,
  MagnifyingGlass,
  X,
  Users,
  Warning,
  ArrowRight,
  CaretDown,
  CheckCircle,
} from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import ProtectedLayout from '@/components/ProtectedLayout';
import { useCompany } from '@/app/company-context';
import { GradientSpinner } from '@/components/ui/GradientSpinner';
import { MetricGroup } from '@/components/dashboard';
import type { Resurs, ResursFormData, StoritevResurs } from '@/types/resursi';
import type { Service } from '@/types/services';
import {
  fetchResursi,
  fetchStoritveResursi,
  saveResurs,
  deleteResurs,
} from '@/lib/supabase/resursi';
import { fetchServicesWithCount } from '@/lib/supabase/services';

import ResursGrid from '@/components/resursi/ResursGrid';
import ResursModal from '@/components/resursi/ResursModal';
import DeleteResursModal from '@/components/resursi/DeleteResursModal';


// ─── Toast ───────────────────────────────────────────────────────────────────

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
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
      {type === 'success'
        ? <Cube className="h-5 w-5" weight="bold" />
        : <Warning className="h-5 w-5" weight="bold" />
      }
      <span className="text-sm font-medium">{message}</span>
      <button type="button" onClick={onClose} className="ml-2 rounded-full p-0.5 hover:bg-white/20">
        <X className="h-4 w-4" weight="bold" />
      </button>
    </motion.div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ onCreate }: { onCreate: () => void }) {
  const t = useTranslations('resursi');
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center rounded-xl border border-gray-100 bg-white p-12"
    >
      <Cube className="mb-3 h-7 w-7 text-gray-300" weight="regular" />
      <h3 className="text-base font-semibold text-gray-900">{t('emptyState.title')}</h3>
      <p className="mt-1 text-center text-sm text-gray-500">{t('emptyState.subtitle')}</p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 active:opacity-80"
      >
        <Plus size={17} weight="bold" />
        {t('emptyState.addFirst')}
      </button>
    </motion.div>
  );
}

// ─── Search empty state ───────────────────────────────────────────────────────

function SearchEmptyState({ searchTerm, onClear }: { searchTerm: string; onClear: () => void }) {
  const t = useTranslations('resursi');
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center rounded-xl border border-gray-100 bg-white p-12"
    >
      <MagnifyingGlass className="mb-3 h-7 w-7 text-gray-300" weight="regular" />
      <h3 className="text-base font-semibold text-gray-900">{t('searchEmpty.title', { term: searchTerm })}</h3>
      <p className="mt-1 text-center text-sm text-gray-500">{t('searchEmpty.subtitle')}</p>
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

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ResursiPage() {
  const router = useRouter();
  const { companyId, loading: companyLoading } = useCompany();
  const t = useTranslations('resursi');

  // Data
  const [resursi, setResursi] = useState<Resurs[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [links, setLinks] = useState<StoritevResurs[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search / filter
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showInactive, setShowInactive] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedResurs, setSelectedResurs] = useState<Resurs | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Delete modal
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteResursItem, setDeleteResursItem] = useState<Resurs | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  }, []);

  // Redirect if no company
  useEffect(() => {
    if (companyLoading) return;
    if (!companyId) router.replace('/onboarding');
  }, [companyId, companyLoading, router]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load data
  const loadData = useCallback(async () => {
    if (!companyId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [resursiRes, servicesRes, linksRes] = await Promise.all([
        fetchResursi(companyId),
        fetchServicesWithCount(companyId),
        fetchStoritveResursi(companyId),
      ]);

      if (resursiRes.error) throw new Error(resursiRes.error);

      // Attach linked services to each resurs
      const linksData = linksRes.data ?? [];
      const serviceMap = new Map((servicesRes.data ?? []).map((s) => [s.id, s]));

      const enriched = resursiRes.data.map((r) => {
        const storitve = linksData
          .filter((l) => l.id_resursa === r.id)
          .map((l) => {
            const svc = serviceMap.get(l.id_storitve);
            return {
              id_storitve: l.id_storitve,
              naziv_storitve: svc?.naziv,
              barva_storitve: svc?.barva,
            };
          });
        return { ...r, storitve };
      });

      setResursi(enriched);
      setServices((servicesRes.data ?? []).filter((s) => s.aktivna));
      setLinks(linksData);
    } catch (err) {
      setError(t('page.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [companyId, t]);

  useEffect(() => { loadData(); }, [loadData]);

  // Filtered list
  const filteredResursi = useMemo(() => {
    let list = resursi;
    if (!showInactive) list = list.filter((r) => r.status === 'active');
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter((r) => r.naziv.toLowerCase().includes(q) || (r.opis ?? '').toLowerCase().includes(q));
    }
    return list;
  }, [resursi, showInactive, debouncedSearch]);

  // Modal open/close
  const openCreateModal = useCallback(() => {
    setSelectedResurs(null);
    setModalMode('create');
    setModalOpen(true);
  }, []);

  const openEditModal = useCallback((r: Resurs) => {
    setSelectedResurs(r);
    setModalMode('edit');
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setSelectedResurs(null);
  }, []);

  // Get linked service IDs for the selected resurs (for the modal)
  const linkedStoritevIds = useMemo(() => {
    if (!selectedResurs) return [];
    return links.filter((l) => l.id_resursa === selectedResurs.id).map((l) => l.id_storitve);
  }, [selectedResurs, links]);

  // Save
  const handleSave = useCallback(async (data: ResursFormData) => {
    if (!companyId) return;
    setIsSaving(true);
    try {
      const result = await saveResurs(companyId, data, selectedResurs?.id);
      if (result.error) throw new Error(result.error);
      showToast(modalMode === 'create' ? t('toasts.created') : t('toasts.updated'), 'success');
      closeModal();
      loadData();
    } catch {
      showToast(t('toasts.errorSave'), 'error');
    } finally {
      setIsSaving(false);
    }
  }, [companyId, selectedResurs, modalMode, showToast, closeModal, loadData, t]);

  // Toggle active
  const handleToggleActive = useCallback(async (r: Resurs) => {
    if (!companyId) return;
    const newStatus = r.status === 'active' ? 'inactive' : 'active';
    setResursi((prev) => prev.map((x) => x.id === r.id ? { ...x, status: newStatus } : x));
    try {
      const result = await saveResurs(companyId, {
        naziv: r.naziv,
        booking_naziv: r.booking_naziv ?? '',
        opis: r.opis ?? '',
        barva: r.barva,
        kolicina: r.kolicina,
        kapaciteta: r.kapaciteta,
        prikazi_v_bookingu: r.prikazi_v_bookingu,
        urnik: r.urnik,
        status: newStatus,
        storitve_ids: links.filter((l) => l.id_resursa === r.id).map((l) => l.id_storitve),
      }, r.id);
      if (result.error) throw new Error(result.error);
    } catch {
      setResursi((prev) => prev.map((x) => x.id === r.id ? { ...x, status: r.status } : x));
      showToast(t('toasts.errorStatus'), 'error');
    }
  }, [companyId, links, showToast, t]);

  // Delete
  const openDeleteModal = useCallback((r: Resurs) => {
    setDeleteResursItem(r);
    setDeleteOpen(true);
  }, []);

  const closeDeleteModal = useCallback(() => {
    setDeleteOpen(false);
    setDeleteResursItem(null);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!companyId || !deleteResursItem) return;
    setIsDeleting(true);
    try {
      const err = await deleteResurs(companyId, deleteResursItem.id);
      if (err) throw new Error(err);
      showToast(t('toasts.deleted'), 'success');
      closeDeleteModal();
      loadData();
    } catch {
      showToast(t('toasts.errorDelete'), 'error');
    } finally {
      setIsDeleting(false);
    }
  }, [companyId, deleteResursItem, showToast, closeDeleteModal, loadData, t]);

  // Stats
  const totalCapacity = useMemo(() =>
    resursi.filter((r) => r.status === 'active').reduce((s, r) => s + r.kolicina * r.kapaciteta, 0),
  [resursi]);

  const activeCount = resursi.filter((r) => r.status === 'active').length;

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
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">

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

          {/* Povzetek — ena kartica z lasnimi črtami, kot drugod */}
          {resursi.length > 0 && (
            <div className="mb-8">
              <MetricGroup
                metrics={[
                  { label: t('stats.total'), value: resursi.length, icon: Cube },
                  { label: t('stats.active'), value: activeCount, icon: CheckCircle },
                  { label: t('stats.totalCapacity'), value: totalCapacity, icon: Users },
                ]}
              />
            </div>
          )}

          {/* Search and filter bar */}
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[260px] max-w-md flex-1">
              <MagnifyingGlass className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" weight="regular" />
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

            <button
              type="button"
              onClick={() => setShowInactive(!showInactive)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                showInactive
                  ? 'border border-gray-200 bg-white text-gray-900 hover:bg-gray-50'
                  : 'border border-gray-900 bg-gray-900 text-white'
              }`}
            >
              {showInactive ? t('page.showAll') : t('page.showActiveOnly')}
              <CaretDown className={`h-3.5 w-3.5 transition-transform ${showInactive ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Results count */}
          {debouncedSearch && filteredResursi.length > 0 && (
            <p className="mb-4 text-sm text-gray-500">
              {t('page.resultsCount', { current: filteredResursi.length, total: resursi.length })}
            </p>
          )}

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-6 flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-4"
            >
              <Warning className="h-5 w-5 flex-shrink-0 text-red-500" weight="regular" />
              <p className="text-sm text-red-700">{error}</p>
              <button type="button" onClick={loadData} className="ml-auto text-sm font-medium text-red-600 hover:text-red-700">
                {t('page.retry')}
              </button>
            </motion.div>
          )}

          {/* Content */}
          {isLoading ? (
            <ResursGrid resursi={[]} onEdit={() => {}} onDelete={() => {}} onToggleActive={() => {}} isLoading />
          ) : resursi.length === 0 ? (
            <EmptyState onCreate={openCreateModal} />
          ) : filteredResursi.length === 0 && debouncedSearch ? (
            <SearchEmptyState searchTerm={debouncedSearch} onClear={() => setSearch('')} />
          ) : (
            <ResursGrid
              resursi={filteredResursi}
              onEdit={openEditModal}
              onDelete={openDeleteModal}
              onToggleActive={handleToggleActive}
            />
          )}
        </div>
      </main>

      {/* Add/Edit Modal */}
      <ResursModal
        isOpen={modalOpen}
        onClose={closeModal}
        resurs={selectedResurs}
        mode={modalMode}
        services={services}
        onSave={handleSave}
        isSaving={isSaving}
        linkedStoritevIds={linkedStoritevIds}
      />

      {/* Delete Modal */}
      <DeleteResursModal
        isOpen={deleteOpen}
        onClose={closeDeleteModal}
        resurs={deleteResursItem}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}
      </AnimatePresence>
    </ProtectedLayout>
  );
}
