'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, PencilSimple, Trash, X, MagnifyingGlass, Tag } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { useCompany } from '@/app/company-context';
import { fetchStoritve } from '@/lib/companyScope';
import type { Storitev } from '@/types/appointments';

interface Popust {
  id: string;
  company_id: string;
  naziv: string;
  tip_popusta: 'percentage' | 'fixed';
  vrednost: number;
  datum_zacetek: string;
  datum_konec: string;
  aktiven: boolean;
  storitev_ids: string[];
}

interface PopustFormData {
  naziv: string;
  tip_popusta: 'percentage' | 'fixed';
  vrednost: string;
  datum_zacetek: string;
  datum_konec: string;
  aktiven: boolean;
  storitev_ids: string[];
}

const DEFAULT_FORM: PopustFormData = {
  naziv: '',
  tip_popusta: 'percentage',
  vrednost: '',
  datum_zacetek: '',
  datum_konec: '',
  aktiven: true,
  storitev_ids: [],
};

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('sl-SI');
}

export default function DiscountsPage() {
  const t = useTranslations('promotions');
  const tc = useTranslations('common');
  const { companyId } = useCompany();
  const [discounts, setDiscounts] = useState<Popust[]>([]);
  const [services, setServices] = useState<Storitev[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PopustFormData>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [serviceSearch, setServiceSearch] = useState('');

  const getStatus = (popust: Popust): { label: string; color: string } => {
    const today = new Date().toISOString().split('T')[0];
    if (!popust.aktiven) return { label: tc('status.inactive'), color: 'bg-gray-100 text-gray-600' };
    if (popust.datum_konec && popust.datum_konec < today) return { label: tc('status.expired'), color: 'bg-orange-100 text-orange-700' };
    return { label: tc('status.active'), color: 'bg-emerald-100 text-emerald-700' };
  };

  const loadDiscounts = useCallback(async () => {
    if (!companyId) return;
    try {
      const res = await fetch(`/api/promotions/discounts?company_id=${companyId}`);
      const data = await res.json();
      if (data.ok) setDiscounts(data.data || []);
    } catch {
      toast.error(t('discounts.toasts.loadError'));
    } finally {
      setLoading(false);
    }
  }, [companyId, t]);

  useEffect(() => {
    loadDiscounts();
  }, [loadDiscounts]);

  useEffect(() => {
    if (!companyId) return;
    fetchStoritve(companyId).then(({ data }) => {
      if (data) setServices(data as unknown as Storitev[]);
    });
  }, [companyId]);

  const openCreate = () => {
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setModalOpen(true);
  };

  const openEdit = (popust: Popust) => {
    setEditingId(popust.id);
    setForm({
      naziv: popust.naziv,
      tip_popusta: popust.tip_popusta,
      vrednost: String(popust.vrednost),
      datum_zacetek: popust.datum_zacetek,
      datum_konec: popust.datum_konec,
      aktiven: popust.aktiven,
      storitev_ids: popust.storitev_ids || [],
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!companyId) return;
    if (!form.naziv.trim()) { toast.error(t('discounts.toasts.nameRequired')); return; }
    const vrednost = parseFloat(form.vrednost);
    if (!vrednost || vrednost <= 0) { toast.error(t('discounts.toasts.valueRequired')); return; }
    if (form.tip_popusta === 'percentage' && vrednost > 100) { toast.error(t('discounts.toasts.percentMax')); return; }
    if (form.datum_konec && form.datum_zacetek && form.datum_konec < form.datum_zacetek) { toast.error(t('discounts.toasts.dateOrder')); return; }
    if (form.storitev_ids.length === 0) { toast.error(t('discounts.toasts.serviceRequired')); return; }

    setSaving(true);
    try {
      const url = editingId ? `/api/promotions/discounts/${editingId}` : '/api/promotions/discounts';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, vrednost, company_id: companyId }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      toast.success(editingId ? t('discounts.toasts.updated') : t('discounts.toasts.created'));
      setModalOpen(false);
      loadDiscounts();
    } catch (err) {
      toast.error(t('discounts.toasts.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/promotions/discounts/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      toast.success(t('discounts.toasts.deleted'));
      setDeleteId(null);
      loadDiscounts();
    } catch {
      toast.error(t('discounts.toasts.deleteError'));
    }
  };

  const handleToggleActive = async (popust: Popust) => {
    try {
      const res = await fetch(`/api/promotions/discounts/${popust.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...popust, vrednost: popust.vrednost, aktiven: !popust.aktiven }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      loadDiscounts();
    } catch {
      toast.error(t('discounts.toasts.updateError'));
    }
  };

  const toggleService = (id: string) => {
    setForm((prev) => ({
      ...prev,
      storitev_ids: prev.storitev_ids.includes(id)
        ? prev.storitev_ids.filter((s) => s !== id)
        : [...prev.storitev_ids, id],
    }));
  };

  const filtered = discounts.filter((d) =>
    d.naziv.toLowerCase().includes(search.toLowerCase())
  );

  const filteredServices = services.filter((s) => {
    const naziv = (s as unknown as Record<string, unknown>)['Naziv'] ?? (s as unknown as Record<string, unknown>)['naziv'] ?? s.naziv ?? '';
    return String(naziv).toLowerCase().includes(serviceSearch.toLowerCase());
  });

  const getServiceName = (id: string) => {
    const svc = services.find((s) => s.id === id);
    if (!svc) return id;
    const raw = svc as unknown as Record<string, unknown>;
    return String(raw['Naziv'] ?? raw['naziv'] ?? svc.naziv ?? id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" weight="regular" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('discounts.search')}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
          />
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
          style={{ background: 'linear-gradient(135deg, #6D5EF7 0%, #2F80ED 100%)' }}
        >
          <Plus className="w-4 h-4" weight="bold" />
          {t('discounts.newButton')}
        </motion.button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Tag className="w-10 h-10 mx-auto mb-3 opacity-40" weight="thin" />
          <p className="text-sm">{t('discounts.empty')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('discounts.table.name')}</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('discounts.table.services')}</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('discounts.table.discount')}</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('discounts.table.dateFrom')}</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('discounts.table.dateTo')}</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('discounts.table.status')}</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('discounts.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {filtered.map((popust, i) => {
                  const status = getStatus(popust);
                  return (
                    <motion.tr
                      key={popust.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-medium text-gray-900">{popust.naziv}</td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700 cursor-pointer"
                          title={(popust.storitev_ids || []).map(getServiceName).join(', ')}
                        >
                          {t('discounts.serviceCount', { count: (popust.storitev_ids || []).length })}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-gray-900">
                        {popust.tip_popusta === 'percentage' ? `${popust.vrednost}%` : `${popust.vrednost} €`}
                      </td>
                      <td className="py-3.5 px-4 text-gray-600">{formatDate(popust.datum_zacetek)}</td>
                      <td className="py-3.5 px-4 text-gray-600">{formatDate(popust.datum_konec)}</td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-end gap-2">
                          {/* Active toggle */}
                          <button
                            onClick={() => handleToggleActive(popust)}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                              popust.aktiven ? 'bg-gray-900' : 'bg-gray-300'
                            }`}
                          >
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${popust.aktiven ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
                          </button>
                          <button onClick={() => openEdit(popust)} className="p-1.5 text-gray-400 hover:text-violet-600 transition-colors rounded-lg hover:bg-violet-50">
                            <PencilSimple className="w-4 h-4" weight="regular" />
                          </button>
                          <button onClick={() => setDeleteId(popust.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50">
                            <Trash className="w-4 h-4" weight="regular" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingId ? t('discounts.modal.editTitle') : t('discounts.modal.createTitle')}
                </h2>
                <button onClick={() => setModalOpen(false)} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
                  <X className="w-5 h-5" weight="bold" />
                </button>
              </div>

              <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
                {/* Naziv */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">{t('discounts.modal.fields.name')}</label>
                  <input
                    value={form.naziv}
                    onChange={(e) => setForm((p) => ({ ...p, naziv: e.target.value }))}
                    placeholder={t('discounts.modal.fields.namePlaceholder')}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                  />
                </div>

                {/* Tip popusta */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">{t('discounts.modal.fields.type')}</label>
                  <div className="flex gap-3">
                    {(['percentage', 'fixed'] as const).map((val) => (
                      <label key={val} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={form.tip_popusta === val}
                          onChange={() => setForm((p) => ({ ...p, tip_popusta: val }))}
                          className="accent-violet-600"
                        />
                        <span className="text-sm text-gray-700">{t(`shared.discountType.${val}`)}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Vrednost */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                    {t('discounts.modal.fields.value', { unit: t(`shared.valueUnit.${form.tip_popusta}`) })}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={form.tip_popusta === 'percentage' ? 100 : undefined}
                    step="0.01"
                    value={form.vrednost}
                    onChange={(e) => setForm((p) => ({ ...p, vrednost: e.target.value }))}
                    placeholder={form.tip_popusta === 'percentage' ? '20' : '5.00'}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                  />
                </div>

                {/* Datumi */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">{t('discounts.modal.fields.dateFrom')}</label>
                    <input
                      type="date"
                      value={form.datum_zacetek}
                      onChange={(e) => setForm((p) => ({ ...p, datum_zacetek: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">{t('discounts.modal.fields.dateTo')}</label>
                    <input
                      type="date"
                      value={form.datum_konec}
                      onChange={(e) => setForm((p) => ({ ...p, datum_konec: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                    />
                  </div>
                </div>

                {/* Storitve */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                    {t('discounts.modal.fields.services', { count: form.storitev_ids.length })}
                  </label>
                  <div className="relative mb-2">
                    <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" weight="regular" />
                    <input
                      value={serviceSearch}
                      onChange={(e) => setServiceSearch(e.target.value)}
                      placeholder={t('shared.serviceSearch')}
                      className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                    />
                  </div>
                  {/* Selected chips */}
                  {form.storitev_ids.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {form.storitev_ids.map((id) => (
                        <span key={id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-violet-100 text-violet-700 rounded-full text-xs font-medium">
                          {getServiceName(id)}
                          <button onClick={() => toggleService(id)} className="hover:text-violet-900">
                            <X className="w-3 h-3" weight="bold" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="max-h-36 overflow-y-auto space-y-1 border border-gray-100 rounded-xl p-2">
                    {filteredServices.map((svc) => {
                      const naziv = (() => { const r = svc as unknown as Record<string, unknown>; return String(r['Naziv'] ?? r['naziv'] ?? svc.naziv ?? svc.id); })();
                      const selected = form.storitev_ids.includes(svc.id);
                      return (
                        <button
                          key={svc.id}
                          onClick={() => toggleService(svc.id)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                            selected ? 'bg-violet-50 text-violet-700' : 'hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          <span>{naziv}</span>
                          {selected && <span className="text-violet-500 text-xs font-medium">✓</span>}
                        </button>
                      );
                    })}
                    {filteredServices.length === 0 && (
                      <p className="text-center py-4 text-sm text-gray-400">{t('shared.noServices')}</p>
                    )}
                  </div>
                </div>

                {/* Aktiven */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <span className="text-sm font-medium text-gray-700">{t('shared.activeLabel')}</span>
                  <button
                    onClick={() => setForm((p) => ({ ...p, aktiven: !p.aktiven }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.aktiven ? 'bg-gray-900' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.aktiven ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                <button onClick={() => setModalOpen(false)} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                  {t('shared.cancelButton')}
                </button>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-xl disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #6D5EF7 0%, #2F80ED 100%)' }}
                >
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
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center">
              <p className="text-base font-semibold text-gray-900 mb-2">{t('discounts.deleteConfirm.title')}</p>
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
