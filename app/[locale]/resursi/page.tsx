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
} from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import ProtectedLayout from '@/components/ProtectedLayout';
import { useCompany } from '@/app/company-context';
import { GradientSpinner } from '@/components/ui/GradientSpinner';
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

const RESOURCE_ACCENT = 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)';

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
      className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white p-12 shadow-sm"
    >
      <div
        className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl text-white shadow-sm"
        style={{ background: RESOURCE_ACCENT }}
      >
        <Cube className="h-10 w-10" weight="duotone" />
      </div>
      <h3 className="text-xl font-semibold text-[#1A1F36]">{t('emptyState.title')}</h3>
      <p className="mt-2 text-center text-sm text-gray-500">{t('emptyState.subtitle')}</p>
      <motion.button
        type="button"
        onClick={onCreate}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="mt-6 flex items-center gap-2 rounded-lg bg-[#0a0a0a] px-6 py-3
                   text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#1f1f1f]"
      >
        <Plus className="h-5 w-5" weight="bold" />
        {t('emptyState.addFirst')}
      </motion.button>
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
      className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white p-12 shadow-sm"
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-gray-100 to-slate-100">
        <MagnifyingGlass className="h-8 w-8 text-gray-400" weight="duotone" />
      </div>
      <h3 className="text-lg font-semibold text-[#1A1F36]">{t('searchEmpty.title', { term: searchTerm })}</h3>
      <p className="mt-2 text-center text-sm text-gray-500">{t('searchEmpty.subtitle')}</p>
      <motion.button
        type="button"
        onClick={onClear}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="mt-4 flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900"
      >
        {t('searchEmpty.clear')}
        <ArrowRight className="h-4 w-4" weight="bold" />
      </motion.button>
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
      <main className="min-h-screen bg-[linear-gradient(180deg,#FAFBFF_0%,#F7F8FA_36%,#F7F8FA_100%)]">
        <div className="mx-auto max-w-7xl px-6 py-8">

          {/* Header */}
          <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div>
              <motion.h1
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-2xl font-normal text-[#1A1F36]"
              >
                {t('page.title')}
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="mt-1 text-gray-500"
              >
                {t('page.subtitle')}
              </motion.p>
            </div>
            <motion.button
              type="button"
              onClick={openCreateModal}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 rounded-lg bg-[#0a0a0a] px-5 py-3
                         text-sm font-medium text-white shadow-sm transition-colors
                         hover:bg-[#1f1f1f]"
            >
              <Plus className="h-5 w-5" weight="bold" />
              {t('page.newButton')}
            </motion.button>
          </div>

          {/* Stats */}
          {resursi.length > 0 && (
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { icon: <Cube className="h-6 w-6" weight="regular" />, value: resursi.length, label: t('stats.total') },
                { icon: <Cube className="h-6 w-6" weight="fill" />, value: activeCount, label: t('stats.active') },
                { icon: <Users className="h-6 w-6" weight="regular" />, value: totalCapacity, label: t('stats.totalCapacity') },
              ].map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.3 }}
                  className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:border-gray-200 hover:shadow-md"
                >
                  <div className="absolute inset-x-0 top-0 h-0.5 opacity-80" style={{ background: RESOURCE_ACCENT }} />
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F7F8FA] text-gray-700 ring-1 ring-gray-100">
                      {stat.icon}
                    </div>
                    <div>
                      <p className="text-2xl font-normal text-[#1A1F36]">{stat.value}</p>
                      <p className="text-xs font-medium text-gray-500">{stat.label}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Search and filter bar */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
          >
            <div className="relative flex-1 min-w-[280px] max-w-md">
              <MagnifyingGlass className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" weight="regular" />
              <input
                type="text"
                placeholder={t('page.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-[#F7F8FA] py-3 pl-12 pr-12 text-sm text-[#1A1F36]
                           placeholder-gray-400 transition-colors
                           focus:border-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1
                             text-gray-400 hover:bg-gray-100 hover:text-[#1A1F36]"
                >
                  <X className="h-4 w-4" weight="bold" />
                </button>
              )}
            </div>

            <motion.button
              type="button"
              onClick={() => setShowInactive(!showInactive)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-colors
                         ${showInactive
                           ? 'bg-[#F7F8FA] text-gray-600 ring-1 ring-gray-200 hover:bg-white hover:text-gray-900'
                           : 'bg-gray-900 text-white'
                         }`}
            >
              {showInactive ? t('page.showAll') : t('page.showActiveOnly')}
              <CaretDown className={`h-4 w-4 transition-transform ${showInactive ? 'rotate-180' : ''}`} />
            </motion.button>
          </motion.div>

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
              className="mb-6 flex items-center gap-3 rounded-lg border border-red-100 bg-red-50 px-4 py-3"
            >
              <Warning className="h-5 w-5 flex-shrink-0 text-red-500" weight="fill" />
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
