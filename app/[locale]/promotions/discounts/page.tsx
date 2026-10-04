'use client';

import { useState, useEffect, useCallback } from 'react';
import { useFormat } from '@/hooks/useFormat';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, PencilSimple, Trash, X, MagnifyingGlass, Tag } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useTranslations, useLocale } from 'next-intl';
import { intlLocale } from '@/lib/format';
import { useCompany } from '@/app/company-context';
import { fetchStoritve } from '@/lib/companyScope';
import type { Storitev } from '@/types/appointments';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { MiniSwitch } from '@/components/ui/MiniSwitch';

import { switchTrack, switchKnob } from '@/components/ui/switchClasses';
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

function formatDate(dateStr: string, locale: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString(intlLocale(locale));
}

export default function DiscountsPage() {
  const { money } = useFormat();
  const t = useTranslations('promotions');
  const locale = useLocale();
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

  const columns: DataTableColumn<Popust>[] = [
    {
      id: 'naziv',
      header: t('discounts.table.name'),
      sortValue: (p) => p.naziv.toLowerCase(),
      cell: (p) => <span className="text-sm font-medium text-gray-900">{p.naziv}</span>,
    },
    {
      id: 'services',
      header: t('discounts.table.services'),
      sortValue: (p) => (p.storitev_ids || []).length,
      cell: (p) => (
        <span
          className="inline-flex cursor-default items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700"
          title={(p.storitev_ids || []).map(getServiceName).join(', ')}
        >
          {t('discounts.serviceCount', { count: (p.storitev_ids || []).length })}
        </span>
      ),
    },
    {
      id: 'value',
      header: t('discounts.table.discount'),
      sortValue: (p) => p.vrednost,
      cell: (p) => (
        <span className="tnum text-sm font-semibold text-gray-900">
          {p.tip_popusta === 'percentage' ? `${p.vrednost}%` : money(p.vrednost)}
        </span>
      ),
    },
    {
      id: 'from',
      header: t('discounts.table.dateFrom'),
      sortValue: (p) => new Date(p.datum_zacetek || 0).getTime(),
      cell: (p) => <span className="tnum whitespace-nowrap text-sm text-gray-600">{formatDate(p.datum_zacetek, locale)}</span>,
    },
    {
      id: 'to',
      header: t('discounts.table.dateTo'),
      sortValue: (p) => new Date(p.datum_konec || 0).getTime(),
      cell: (p) => <span className="tnum whitespace-nowrap text-sm text-gray-600">{formatDate(p.datum_konec, locale)}</span>,
    },
    {
      id: 'status',
      header: t('discounts.table.status'),
      cell: (p) => {
        const status = getStatus(p);
        return (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.color}`}>
            {status.label}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: t('discounts.table.actions'),
      align: 'right',
      cell: (p) => renderActions(p),
    },
  ];

  /** Stikalo, uredi, izbriši — isto v tabeli in v mobilnem seznamu. */
  function renderActions(popust: Popust) {
    return (
      <div className="flex items-center justify-end gap-1">
        <MiniSwitch checked={popust.aktiven} onChange={() => handleToggleActive(popust)} />
        <button
          type="button"
          onClick={() => openEdit(popust)}
          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          <PencilSimple className="h-4 w-4" weight="regular" />
        </button>
        <button
          type="button"
          onClick={() => setDeleteId(popust.id)}
          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
        >
          <Trash className="h-4 w-4" weight="regular" />
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Iskanje in nov popust */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[220px] max-w-sm flex-1">
          <MagnifyingGlass className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" weight="regular" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('discounts.search')}
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 transition-colors focus:border-[#7C78FA] focus:outline-none focus:ring-[3px] focus:ring-[#7C78FA]/25"
          />
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 active:opacity-80"
        >
          <Plus size={17} weight="bold" />
          {t('discounts.newButton')}
        </button>
      </div>

      <DataTable<Popust>
        rows={filtered}
        columns={columns}
        rowKey={(p) => p.id}
        isLoading={loading}
        pageSize={20}
        empty={
          <div className="flex flex-col items-center justify-center rounded-xl border border-gray-100 bg-white p-12 text-center">
            <Tag className="mb-3 h-7 w-7 text-gray-300" weight="regular" />
            <p className="text-sm text-gray-500">{t('discounts.empty')}</p>
          </div>
        }
        mobile={{
          title: (p) => p.naziv,
          subtitle: (p) => (
            <span className="tnum">
              {formatDate(p.datum_zacetek, locale)} – {formatDate(p.datum_konec, locale)}
            </span>
          ),
          meta: (p) => {
            const status = getStatus(p);
            return (
              <div className="flex flex-wrap items-center gap-2">
                <span className="tnum text-[13px] font-semibold text-gray-900">
                  {p.tip_popusta === 'percentage' ? `${p.vrednost}%` : money(p.vrednost)}
                </span>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}>
                  {status.label}
                </span>
              </div>
            );
          },
          trailing: (p) => renderActions(p),
        }}
      />

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
              className="relative flex w-full max-w-xl max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-gray-100 bg-[#F7F8FA] shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4 sm:px-6">
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingId ? t('discounts.modal.editTitle') : t('discounts.modal.createTitle')}
                </h2>
                <button onClick={() => setModalOpen(false)} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
                  <X className="w-5 h-5" weight="bold" />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
                {/* Naziv */}
                <div className="rounded-2xl border border-gray-100 bg-white p-5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">{t('discounts.modal.fields.name')}</label>
                  <input
                    value={form.naziv}
                    onChange={(e) => setForm((p) => ({ ...p, naziv: e.target.value }))}
                    placeholder={t('discounts.modal.fields.namePlaceholder')}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  />
                </div>

                {/* Tip popusta */}
                <div className="rounded-2xl border border-gray-100 bg-white p-5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">{t('discounts.modal.fields.type')}</label>
                  <div className="flex gap-3">
                    {(['percentage', 'fixed'] as const).map((val) => (
                      <label key={val} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={form.tip_popusta === val}
                          onChange={() => setForm((p) => ({ ...p, tip_popusta: val }))}
                          className="accent-gray-900"
                        />
                        <span className="text-sm text-gray-700">{t(`shared.discountType.${val}`)}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Vrednost */}
                <div className="rounded-2xl border border-gray-100 bg-white p-5">
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
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  />
                </div>

                {/* Datumi */}
                <div className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-100 bg-white p-5 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">{t('discounts.modal.fields.dateFrom')}</label>
                    <input
                      type="date"
                      value={form.datum_zacetek}
                      onChange={(e) => setForm((p) => ({ ...p, datum_zacetek: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">{t('discounts.modal.fields.dateTo')}</label>
                    <input
                      type="date"
                      value={form.datum_konec}
                      onChange={(e) => setForm((p) => ({ ...p, datum_konec: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                    />
                  </div>
                </div>

                {/* Storitve */}
                <div className="rounded-2xl border border-gray-100 bg-white p-5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                    {t('discounts.modal.fields.services', { count: form.storitev_ids.length })}
                  </label>
                  <div className="relative mb-2">
                    <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" weight="regular" />
                    <input
                      value={serviceSearch}
                      onChange={(e) => setServiceSearch(e.target.value)}
                      placeholder={t('shared.serviceSearch')}
                      className="w-full rounded-lg border border-gray-200 py-2 pl-8 pr-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                    />
                  </div>
                  {/* Selected chips */}
                  {form.storitev_ids.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {form.storitev_ids.map((id) => (
                        <span key={id} className="inline-flex items-center gap-1 rounded-lg bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 ring-1 ring-gray-100">
                          {getServiceName(id)}
                          <button onClick={() => toggleService(id)} className="hover:text-gray-900">
                            <X className="w-3 h-3" weight="bold" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="max-h-36 overflow-y-auto space-y-1 rounded-lg border border-gray-100 p-2">
                    {filteredServices.map((svc) => {
                      const naziv = (() => { const r = svc as unknown as Record<string, unknown>; return String(r['Naziv'] ?? r['naziv'] ?? svc.naziv ?? svc.id); })();
                      const selected = form.storitev_ids.includes(svc.id);
                      return (
                        <button
                          key={svc.id}
                          onClick={() => toggleService(svc.id)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                            selected ? 'bg-gray-100 text-gray-900' : 'hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          <span>{naziv}</span>
                          {selected && <span className="text-xs font-medium text-gray-900">✓</span>}
                        </button>
                      );
                    })}
                    {filteredServices.length === 0 && (
                      <p className="text-center py-4 text-sm text-gray-400">{t('shared.noServices')}</p>
                    )}
                  </div>
                </div>

                {/* Aktiven */}
                <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-5">
                  <span className="text-sm font-medium text-gray-700">{t('shared.activeLabel')}</span>
                  <button
                    onClick={() => setForm((p) => ({ ...p, aktiven: !p.aktiven }))}
                    className={`${switchTrack} ${form.aktiven ? 'bg-gray-900' : 'bg-gray-300'}`}
                  >
                    <span className={`${switchKnob(form.aktiven)}`} />
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-gray-100 bg-white px-4 py-4 sm:px-5">
                <button onClick={() => setModalOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900">
                  {t('shared.cancelButton')}
                </button>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-50"
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
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-xl">
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
