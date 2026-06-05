'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, PencilSimple, Trash, X, MagnifyingGlass, Clock } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { useCompany } from '@/app/company-context';
import { fetchStoritve } from '@/lib/companyScope';
import type { Storitev } from '@/types/appointments';

interface HappyHour {
  id: string;
  company_id: string;
  naziv: string;
  dnevi_v_tednu: number[];
  cas_zacetek: string;
  cas_konec: string;
  tip_popusta: 'percentage' | 'fixed';
  vrednost: number;
  vse_storitve: boolean;
  aktiven: boolean;
  storitev_ids: string[];
}

interface HHFormData {
  naziv: string;
  dnevi_v_tednu: number[];
  cas_zacetek: string;
  cas_konec: string;
  tip_popusta: 'percentage' | 'fixed';
  vrednost: string;
  vse_storitve: boolean;
  aktiven: boolean;
  storitev_ids: string[];
}

const DEFAULT_FORM: HHFormData = {
  naziv: '',
  dnevi_v_tednu: [],
  cas_zacetek: '',
  cas_konec: '',
  tip_popusta: 'percentage',
  vrednost: '',
  vse_storitve: true,
  aktiven: true,
  storitev_ids: [],
};

export default function HappyHoursPage() {
  const t = useTranslations('promotions');
  const tc = useTranslations('common');
  const { companyId } = useCompany();
  const [happyHours, setHappyHours] = useState<HappyHour[]>([]);
  const [services, setServices] = useState<Storitev[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<HHFormData>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [serviceSearch, setServiceSearch] = useState('');

  // Sunday-first day labels mapped from common.daysShort (Sun=0 … Sat=6)
  const DAYS = [
    tc('daysShort.sun'),
    tc('daysShort.mon'),
    tc('daysShort.tue'),
    tc('daysShort.wed'),
    tc('daysShort.thu'),
    tc('daysShort.fri'),
    tc('daysShort.sat'),
  ];

  const load = useCallback(async () => {
    if (!companyId) return;
    try {
      const res = await fetch(`/api/promotions/happy-hours?company_id=${companyId}`);
      const data = await res.json();
      if (data.ok) setHappyHours(data.data || []);
    } catch {
      toast.error(t('happyHours.toasts.loadError'));
    } finally {
      setLoading(false);
    }
  }, [companyId, t]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!companyId) return;
    fetchStoritve(companyId).then(({ data }) => { if (data) setServices(data as unknown as Storitev[]); });
  }, [companyId]);

  const openCreate = () => { setEditingId(null); setForm(DEFAULT_FORM); setModalOpen(true); };

  const openEdit = (hh: HappyHour) => {
    setEditingId(hh.id);
    setForm({ naziv: hh.naziv, dnevi_v_tednu: hh.dnevi_v_tednu || [], cas_zacetek: hh.cas_zacetek, cas_konec: hh.cas_konec, tip_popusta: hh.tip_popusta, vrednost: String(hh.vrednost), vse_storitve: hh.vse_storitve, aktiven: hh.aktiven, storitev_ids: hh.storitev_ids || [] });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!companyId) return;
    if (!form.naziv.trim()) { toast.error(t('happyHours.toasts.nameRequired')); return; }
    if (form.dnevi_v_tednu.length === 0) { toast.error(t('happyHours.toasts.dayRequired')); return; }
    if (!form.cas_zacetek || !form.cas_konec) { toast.error(t('happyHours.toasts.timeRequired')); return; }
    if (form.cas_konec <= form.cas_zacetek) { toast.error(t('happyHours.toasts.timeOrder')); return; }
    const vrednost = parseFloat(form.vrednost);
    if (!vrednost || vrednost <= 0) { toast.error(t('happyHours.toasts.valueRequired')); return; }
    if (form.tip_popusta === 'percentage' && vrednost > 100) { toast.error(t('happyHours.toasts.percentMax')); return; }
    if (!form.vse_storitve && form.storitev_ids.length === 0) { toast.error(t('happyHours.toasts.serviceRequired')); return; }

    setSaving(true);
    try {
      const url = editingId ? `/api/promotions/happy-hours/${editingId}` : '/api/promotions/happy-hours';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, vrednost, company_id: companyId }) });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      toast.success(editingId ? t('happyHours.toasts.updated') : t('happyHours.toasts.created'));
      setModalOpen(false);
      load();
    } catch { toast.error(t('happyHours.toasts.saveError')); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/promotions/happy-hours/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      toast.success(t('happyHours.toasts.deleted'));
      setDeleteId(null);
      load();
    } catch { toast.error(t('happyHours.toasts.deleteError')); }
  };

  const handleToggleActive = async (hh: HappyHour) => {
    try {
      await fetch(`/api/promotions/happy-hours/${hh.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...hh, vrednost: hh.vrednost, aktiven: !hh.aktiven }) });
      load();
    } catch { toast.error(t('happyHours.toasts.genericError')); }
  };

  const toggleDay = (day: number) => {
    setForm((p) => ({ ...p, dnevi_v_tednu: p.dnevi_v_tednu.includes(day) ? p.dnevi_v_tednu.filter((d) => d !== day) : [...p.dnevi_v_tednu, day] }));
  };

  const toggleService = (id: string) => {
    setForm((p) => ({ ...p, storitev_ids: p.storitev_ids.includes(id) ? p.storitev_ids.filter((s) => s !== id) : [...p.storitev_ids, id] }));
  };

  const getServiceName = (id: string) => {
    const svc = services.find((s) => s.id === id);
    if (!svc) return id;
    const raw = svc as unknown as Record<string, unknown>;
    return String(raw['Naziv'] ?? raw['naziv'] ?? svc.naziv ?? id);
  };

  const filteredServices = services.filter((s) => {
    const naziv = (() => { const r = s as unknown as Record<string, unknown>; return String(r['Naziv'] ?? r['naziv'] ?? s.naziv ?? ''); })();
    return naziv.toLowerCase().includes(serviceSearch.toLowerCase());
  });

  if (loading) return <div className="flex items-center justify-center py-16"><div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-900 border-t-transparent" /></div>;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-medium text-gray-600">{t('happyHours.count', { count: happyHours.length })}</h3>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-[#0a0a0a] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#1f1f1f]">
          <Plus className="w-4 h-4" weight="bold" />
          {t('happyHours.newButton')}
        </motion.button>
      </div>

      {happyHours.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white py-16 text-center text-gray-400 shadow-sm">
          <Clock className="w-10 h-10 mx-auto mb-3 opacity-40" weight="thin" />
          <p className="text-sm">{t('happyHours.empty')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {[
                  t('happyHours.table.name'),
                  t('happyHours.table.days'),
                  t('happyHours.table.time'),
                  t('happyHours.table.discount'),
                  t('happyHours.table.services'),
                  t('happyHours.table.status'),
                  t('happyHours.table.actions'),
                ].map((h) => (
                  <th key={h} className={`py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider ${h === t('happyHours.table.actions') ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {happyHours.map((hh, i) => (
                  <motion.tr key={hh.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.04 }} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-gray-900">{hh.naziv}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1">
                        {(hh.dnevi_v_tednu || []).sort().map((d) => (
                          <span key={d} className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">{DAYS[d]}</span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-gray-600">{hh.cas_zacetek?.substring(0, 5)} – {hh.cas_konec?.substring(0, 5)}</td>
                    <td className="py-3.5 px-4 font-semibold text-gray-900">{hh.tip_popusta === 'percentage' ? `${hh.vrednost}%` : `${hh.vrednost} €`}</td>
                    <td className="py-3.5 px-4">
                      {hh.vse_storitve
                        ? <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">{t('happyHours.servicesAll')}</span>
                        : <span className="rounded-lg bg-gray-50 px-2 py-1 text-xs text-gray-700 ring-1 ring-gray-100">{(hh.storitev_ids || []).length}</span>
                      }
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${hh.aktiven ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                        {hh.aktiven ? tc('status.active') : tc('status.inactive')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleToggleActive(hh)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${hh.aktiven ? 'bg-gray-900' : 'bg-gray-300'}`}>
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${hh.aktiven ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
                        </button>
                        <button onClick={() => openEdit(hh)} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"><PencilSimple className="w-4 h-4" weight="regular" /></button>
                        <button onClick={() => setDeleteId(hh.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"><Trash className="w-4 h-4" weight="regular" /></button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative flex w-full max-w-xl max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-gray-100 bg-[#F7F8FA] shadow-2xl">
              <div className="flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4 sm:px-6">
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingId ? t('happyHours.modal.editTitle') : t('happyHours.modal.createTitle')}
                </h2>
                <button onClick={() => setModalOpen(false)} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"><X className="w-5 h-5" weight="bold" /></button>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
                <div className="rounded-2xl border border-gray-100 bg-white p-5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">{t('happyHours.modal.fields.name')}</label>
                  <input value={form.naziv} onChange={(e) => setForm((p) => ({ ...p, naziv: e.target.value }))} placeholder={t('happyHours.modal.fields.namePlaceholder')} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
                </div>

                {/* Days */}
                <div className="rounded-2xl border border-gray-100 bg-white p-5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">{t('happyHours.modal.fields.days')}</label>
                  <div className="flex gap-1.5">
                    {DAYS.map((label, idx) => (
                      <button
                        key={idx}
                        onClick={() => toggleDay(idx)}
                        className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                          form.dnevi_v_tednu.includes(idx)
                            ? 'bg-gray-900 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Time */}
                <div className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-100 bg-white p-5 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">{t('happyHours.modal.fields.timeFrom')}</label>
                    <input type="time" value={form.cas_zacetek} onChange={(e) => setForm((p) => ({ ...p, cas_zacetek: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">{t('happyHours.modal.fields.timeTo')}</label>
                    <input type="time" value={form.cas_konec} onChange={(e) => setForm((p) => ({ ...p, cas_konec: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
                  </div>
                </div>

                {/* Tip + vrednost */}
                <div className="rounded-2xl border border-gray-100 bg-white p-5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">{t('happyHours.modal.fields.type')}</label>
                  <div className="flex gap-3 mb-3">
                    {(['percentage', 'fixed'] as const).map((val) => (
                      <label key={val} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" checked={form.tip_popusta === val} onChange={() => setForm((p) => ({ ...p, tip_popusta: val }))} className="accent-gray-900" />
                        <span className="text-sm text-gray-700">{t(`shared.discountType.${val}`)}</span>
                      </label>
                    ))}
                  </div>
                  <input type="number" min="0" max={form.tip_popusta === 'percentage' ? 100 : undefined} step="0.01" value={form.vrednost} onChange={(e) => setForm((p) => ({ ...p, vrednost: e.target.value }))} placeholder={form.tip_popusta === 'percentage' ? '20' : '5.00'} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
                </div>

                {/* Storitve */}
                <div className="rounded-2xl border border-gray-100 bg-white p-5">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500">{t('happyHours.modal.fields.services')}</label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.vse_storitve} onChange={() => setForm((p) => ({ ...p, vse_storitve: !p.vse_storitve }))} className="accent-gray-900" />
                      <span className="text-xs text-gray-600">{t('happyHours.modal.fields.allServices')}</span>
                    </label>
                  </div>
                  {!form.vse_storitve && (
                    <>
                      <div className="relative mb-2">
                        <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" weight="regular" />
                        <input value={serviceSearch} onChange={(e) => setServiceSearch(e.target.value)} placeholder={t('shared.serviceSearch')} className="w-full rounded-lg border border-gray-200 py-2 pl-8 pr-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
                      </div>
                      {form.storitev_ids.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {form.storitev_ids.map((id) => (
                            <span key={id} className="inline-flex items-center gap-1 rounded-lg bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 ring-1 ring-gray-100">
                              {getServiceName(id)}
                              <button onClick={() => toggleService(id)}><X className="w-3 h-3" weight="bold" /></button>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="max-h-36 overflow-y-auto space-y-1 rounded-lg border border-gray-100 p-2">
                        {filteredServices.map((svc) => {
                          const naziv = (() => { const r = svc as unknown as Record<string, unknown>; return String(r['Naziv'] ?? r['naziv'] ?? svc.naziv ?? svc.id); })();
                          const selected = form.storitev_ids.includes(svc.id);
                          return (
                            <button key={svc.id} onClick={() => toggleService(svc.id)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${selected ? 'bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-50'}`}>
                              <span>{naziv}</span>
                              {selected && <span className="text-xs font-medium text-gray-900">✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-5">
                  <span className="text-sm font-medium text-gray-700">{t('shared.activeLabel')}</span>
                  <button onClick={() => setForm((p) => ({ ...p, aktiven: !p.aktiven }))} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.aktiven ? 'bg-gray-900' : 'bg-gray-300'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.aktiven ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-gray-100 bg-white px-4 py-4 sm:px-5">
                <button onClick={() => setModalOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900">{t('shared.cancelButton')}</button>
                <motion.button whileTap={{ scale: 0.98 }} onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-lg bg-[#0a0a0a] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#1f1f1f] disabled:opacity-50">
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
              <p className="text-base font-semibold text-gray-900 mb-2">{t('happyHours.deleteConfirm.title')}</p>
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
