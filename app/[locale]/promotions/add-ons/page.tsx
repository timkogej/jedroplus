'use client';

import { useState, useEffect, useCallback } from 'react';
import { useFormat } from '@/hooks/useFormat';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, PencilSimple, Trash, X, MagnifyingGlass } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { useCompany } from '@/app/company-context';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { MiniSwitch } from '@/components/ui/MiniSwitch';
import { fetchStoritve } from '@/lib/companyScope';
import type { Storitev } from '@/types/appointments';

interface AddOn {
  id: string;
  company_id: string;
  storitev_id: string;
  tip_popusta: 'percentage' | 'fixed';
  vrednost_popusta: number;
  aktiven: boolean;
  naziv: string;
  original_cena: number;
  final_cena: number;
  trajanje: number;
}

interface AddOnFormData {
  storitev_id: string;
  tip_popusta: 'percentage' | 'fixed';
  vrednost_popusta: string;
  aktiven: boolean;
}

const DEFAULT_FORM: AddOnFormData = {
  storitev_id: '',
  tip_popusta: 'percentage',
  vrednost_popusta: '',
  aktiven: true,
};

export default function AddOnsPage() {
  const { money } = useFormat();
  const t = useTranslations('promotions');
  const tc = useTranslations('common');
  const { companyId } = useCompany();
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [services, setServices] = useState<Storitev[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AddOnFormData>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [serviceSearch, setServiceSearch] = useState('');

  const load = useCallback(async () => {
    if (!companyId) return;
    try {
      const res = await fetch(`/api/promotions/add-ons?company_id=${companyId}`);
      const data = await res.json();
      if (data.ok) setAddOns(data.data || []);
    } catch {
      toast.error(t('addOns.toasts.loadError'));
    } finally {
      setLoading(false);
    }
  }, [companyId, t]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!companyId) return;
    fetchStoritve(companyId).then(({ data }) => { if (data) setServices(data as unknown as Storitev[]); });
  }, [companyId]);

  const getServiceName = (id: string) => {
    const svc = services.find((s) => s.id === id);
    if (!svc) return id;
    const raw = svc as unknown as Record<string, unknown>;
    return String(raw['Naziv'] ?? raw['naziv'] ?? svc.naziv ?? id);
  };

  const getServicePrice = (id: string): number => {
    const svc = services.find((s) => s.id === id);
    if (!svc) return 0;
    return svc.cena ?? 0;
  };

  const selectedServicePrice = getServicePrice(form.storitev_id);
  const vrednost = parseFloat(form.vrednost_popusta) || 0;
  const previewFinal = form.tip_popusta === 'percentage'
    ? Math.max(0, selectedServicePrice - (selectedServicePrice * vrednost) / 100)
    : Math.max(0, selectedServicePrice - vrednost);

  const openCreate = () => { setEditingId(null); setForm(DEFAULT_FORM); setModalOpen(true); };

  const openEdit = (ao: AddOn) => {
    setEditingId(ao.id);
    setForm({ storitev_id: ao.storitev_id, tip_popusta: ao.tip_popusta, vrednost_popusta: String(ao.vrednost_popusta), aktiven: ao.aktiven });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!companyId) return;
    if (!form.storitev_id) { toast.error(t('addOns.toasts.serviceRequired')); return; }
    const vrednostNum = parseFloat(form.vrednost_popusta);
    if (!vrednostNum || vrednostNum <= 0) { toast.error(t('addOns.toasts.valueRequired')); return; }
    if (form.tip_popusta === 'percentage' && vrednostNum > 100) { toast.error(t('addOns.toasts.percentMax')); return; }

    setSaving(true);
    try {
      const url = editingId ? `/api/promotions/add-ons/${editingId}` : '/api/promotions/add-ons';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, vrednost_popusta: vrednostNum, company_id: companyId }) });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      toast.success(editingId ? t('addOns.toasts.updated') : t('addOns.toasts.created'));
      setModalOpen(false);
      load();
    } catch { toast.error(t('addOns.toasts.saveError')); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/promotions/add-ons/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      toast.success(t('addOns.toasts.deleted'));
      setDeleteId(null);
      load();
    } catch { toast.error(t('addOns.toasts.deleteError')); }
  };

  const handleToggleActive = async (ao: AddOn) => {
    try {
      await fetch(`/api/promotions/add-ons/${ao.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tip_popusta: ao.tip_popusta, vrednost_popusta: ao.vrednost_popusta, aktiven: !ao.aktiven }) });
      load();
    } catch { toast.error(t('addOns.toasts.genericError')); }
  };

  const filteredServices = services.filter((s) => {
    const naziv = (() => { const r = s as unknown as Record<string, unknown>; return String(r['Naziv'] ?? r['naziv'] ?? s.naziv ?? ''); })();
    return naziv.toLowerCase().includes(serviceSearch.toLowerCase());
  });

  const discountLabel = (ao: AddOn) =>
    ao.tip_popusta === 'percentage' ? `${ao.vrednost_popusta}%` : money(ao.vrednost_popusta);

  function renderActions(ao: AddOn) {
    return (
      <div className="flex items-center justify-end gap-1">
        <MiniSwitch checked={ao.aktiven} onChange={() => handleToggleActive(ao)} />
        <button type="button" onClick={() => openEdit(ao)} className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900">
          <PencilSimple className="h-4 w-4" weight="regular" />
        </button>
        <button type="button" onClick={() => setDeleteId(ao.id)} className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500">
          <Trash className="h-4 w-4" weight="regular" />
        </button>
      </div>
    );
  }

  const statusBadge = (ao: AddOn) => (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ao.aktiven ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
      {ao.aktiven ? tc('status.active') : tc('status.inactive')}
    </span>
  );

  const columns: DataTableColumn<AddOn>[] = [
    { id: 'service', header: t('addOns.table.service'),
      sortValue: (a) => (a.naziv || getServiceName(a.storitev_id)).toLowerCase(),
      cell: (a) => <span className="text-sm font-medium text-gray-900">{a.naziv || getServiceName(a.storitev_id)}</span> },
    { id: 'original', header: t('addOns.table.originalPrice'), sortValue: (a) => a.original_cena ?? 0,
      cell: (a) => <span className="tnum text-sm text-gray-600">{a.original_cena != null ? money(a.original_cena) : '–'}</span> },
    { id: 'value', header: t('addOns.table.discount'), sortValue: (a) => a.vrednost_popusta,
      cell: (a) => <span className="tnum text-sm font-semibold text-gray-900">{discountLabel(a)}</span> },
    { id: 'final', header: t('addOns.table.finalPrice'), sortValue: (a) => a.final_cena ?? 0,
      cell: (a) => <span className="tnum text-sm font-semibold text-gray-900">{a.final_cena != null ? money(a.final_cena) : '–'}</span> },
    { id: 'status', header: t('addOns.table.status'), cell: (a) => statusBadge(a) },
    { id: 'actions', header: t('addOns.table.actions'), align: 'right', cell: (a) => renderActions(a) },
  ];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="tnum text-[13px] text-gray-500">{t('addOns.count', { count: addOns.length })}</p>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 active:opacity-80"
        >
          <Plus size={17} weight="bold" />
          {t('addOns.newButton')}
        </button>
      </div>

      <DataTable<AddOn>
        rows={addOns}
        columns={columns}
        rowKey={(a) => a.id}
        isLoading={loading}
        pageSize={20}
        empty={
          <div className="flex flex-col items-center justify-center rounded-xl border border-gray-100 bg-white p-12 text-center">
            <Plus className="mb-3 h-7 w-7 text-gray-300" weight="regular" />
            <p className="text-sm text-gray-500">{t('addOns.empty')}</p>
          </div>
        }
        mobile={{
          title: (a) => a.naziv || getServiceName(a.storitev_id),
          subtitle: (a) => (
            <span className="tnum">
              {a.original_cena != null ? money(a.original_cena) : '–'} → {a.final_cena != null ? money(a.final_cena) : '–'}
            </span>
          ),
          meta: (a) => (
            <div className="flex flex-wrap items-center gap-2">
              <span className="tnum text-[13px] font-semibold text-gray-900">{discountLabel(a)}</span>
              {statusBadge(a)}
            </div>
          ),
          trailing: (a) => renderActions(a),
        }}
      />

      {/* Modal */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative flex w-full max-w-xl max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-gray-100 bg-[#F7F8FA] shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4 sm:px-6">
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingId ? t('addOns.modal.editTitle') : t('addOns.modal.createTitle')}
                </h2>
                <button onClick={() => setModalOpen(false)} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"><X className="w-5 h-5" weight="bold" /></button>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
                {/* Storitev picker */}
                {!editingId && (
                  <div className="rounded-2xl border border-gray-100 bg-white p-5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">{t('addOns.modal.fields.service')}</label>
                    <div className="relative mb-2">
                      <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" weight="regular" />
                      <input value={serviceSearch} onChange={(e) => setServiceSearch(e.target.value)} placeholder={t('shared.serviceSearch')} className="w-full rounded-lg border border-gray-200 py-2 pl-8 pr-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
                    </div>
                    {form.storitev_id && (
                      <div className="mb-2 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-100">
                        <span>{getServiceName(form.storitev_id)}</span>
                        <button onClick={() => setForm((p) => ({ ...p, storitev_id: '' }))}><X className="w-3.5 h-3.5" weight="bold" /></button>
                      </div>
                    )}
                    <div className="max-h-36 overflow-y-auto space-y-1 rounded-lg border border-gray-100 p-2">
                      {filteredServices.map((svc) => {
                        const naziv = (() => { const r = svc as unknown as Record<string, unknown>; return String(r['Naziv'] ?? r['naziv'] ?? svc.naziv ?? svc.id); })();
                        const selected = form.storitev_id === svc.id;
                        return (
                          <button key={svc.id} onClick={() => { setForm((p) => ({ ...p, storitev_id: svc.id })); setServiceSearch(''); }} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${selected ? 'bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-50'}`}>
                            <span>{naziv}</span>
                            <span className="text-xs text-gray-400">{money(svc.cena)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {editingId && (
                  <div className="rounded-2xl border border-gray-100 bg-white p-5">
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">{t('addOns.modal.fields.service')}</p>
                    <p className="text-sm font-medium text-gray-900">{getServiceName(form.storitev_id)}</p>
                  </div>
                )}

                {/* Tip + vrednost */}
                <div className="rounded-2xl border border-gray-100 bg-white p-5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">{t('addOns.modal.fields.type')}</label>
                  <div className="flex gap-3 mb-3">
                    {(['percentage', 'fixed'] as const).map((val) => (
                      <label key={val} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" checked={form.tip_popusta === val} onChange={() => setForm((p) => ({ ...p, tip_popusta: val }))} className="accent-gray-900" />
                        <span className="text-sm text-gray-700">{t(`shared.discountType.${val}`)}</span>
                      </label>
                    ))}
                  </div>
                  <input type="number" min="0" max={form.tip_popusta === 'percentage' ? 100 : undefined} step="0.01" value={form.vrednost_popusta} onChange={(e) => setForm((p) => ({ ...p, vrednost_popusta: e.target.value }))} placeholder={form.tip_popusta === 'percentage' ? '20' : '5.00'} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
                </div>

                {/* Live preview */}
                {form.storitev_id && vrednost > 0 && selectedServicePrice > 0 && (
                  <div className="rounded-2xl border border-gray-100 bg-white p-5">
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">{t('addOns.modal.fields.previewTitle')}</p>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500 line-through">{money(selectedServicePrice)}</span>
                      <span className="text-gray-400">→</span>
                      <span className="text-lg font-bold text-gray-900">
                        {money(previewFinal)}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-5">
                  <span className="text-sm font-medium text-gray-700">{t('addOns.modal.fields.active')}</span>
                  <button onClick={() => setForm((p) => ({ ...p, aktiven: !p.aktiven }))} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.aktiven ? 'bg-gray-900' : 'bg-gray-300'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.aktiven ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-gray-100 bg-white px-4 py-4 sm:px-5">
                <button onClick={() => setModalOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900">{t('shared.cancelButton')}</button>
                <motion.button whileTap={{ scale: 0.98 }} onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-50">
                  {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {editingId ? t('shared.saveButton') : t('shared.createButton')}
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      <AnimatePresence>
        {deleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-xl">
              <p className="text-base font-semibold text-gray-900 mb-2">{t('addOns.deleteConfirm.title')}</p>
              <p className="text-sm text-gray-500 mb-5">{t('shared.cannotUndo')}</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">{t('shared.cancelButton')}</button>
                <button onClick={() => deleteId && handleDelete(deleteId)} className="flex-1 py-2.5 rounded-xl bg-red-500 text-sm font-medium text-white hover:bg-red-600 transition-colors">{t('shared.deleteButton')}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
