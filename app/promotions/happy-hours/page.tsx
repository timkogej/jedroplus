'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, PencilSimple, Trash, X, MagnifyingGlass, Clock } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useCompany } from '@/app/company-context';
import { fetchStoritve } from '@/lib/companyScope';
import type { Storitev } from '@/types/appointments';
import { DAYS_SL } from '@/lib/promotions';

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

  const load = useCallback(async () => {
    if (!companyId) return;
    try {
      const res = await fetch(`/api/promotions/happy-hours?company_id=${companyId}`);
      const data = await res.json();
      if (data.ok) setHappyHours(data.data || []);
    } catch {
      toast.error('Napaka pri nalaganju');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

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
    if (!form.naziv.trim()) { toast.error('Naziv je obvezen'); return; }
    if (form.dnevi_v_tednu.length === 0) { toast.error('Izberite vsaj en dan'); return; }
    if (!form.cas_zacetek || !form.cas_konec) { toast.error('Čas je obvezen'); return; }
    if (form.cas_konec <= form.cas_zacetek) { toast.error('Čas konca mora biti po času začetka'); return; }
    const vrednost = parseFloat(form.vrednost);
    if (!vrednost || vrednost <= 0) { toast.error('Vrednost mora biti večja od 0'); return; }
    if (form.tip_popusta === 'percentage' && vrednost > 100) { toast.error('Odstotek ne sme biti večji od 100'); return; }
    if (!form.vse_storitve && form.storitev_ids.length === 0) { toast.error('Izberite vsaj eno storitev'); return; }

    setSaving(true);
    try {
      const url = editingId ? `/api/promotions/happy-hours/${editingId}` : '/api/promotions/happy-hours';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, vrednost, company_id: companyId }) });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      toast.success(editingId ? 'Happy Hour posodobljen' : 'Happy Hour ustvarjen');
      setModalOpen(false);
      load();
    } catch { toast.error('Napaka pri shranjevanju'); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/promotions/happy-hours/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      toast.success('Happy Hour izbrisan');
      setDeleteId(null);
      load();
    } catch { toast.error('Napaka pri brisanju'); }
  };

  const handleToggleActive = async (hh: HappyHour) => {
    try {
      await fetch(`/api/promotions/happy-hours/${hh.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...hh, vrednost: hh.vrednost, aktiven: !hh.aktiven }) });
      load();
    } catch { toast.error('Napaka'); }
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

  if (loading) return <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-medium text-gray-600">{happyHours.length} happy hours</h3>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #6D5EF7 0%, #2F80ED 100%)' }}>
          <Plus className="w-4 h-4" weight="bold" />
          Nov Happy Hour
        </motion.button>
      </div>

      {happyHours.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Clock className="w-10 h-10 mx-auto mb-3 opacity-40" weight="thin" />
          <p className="text-sm">Ni happy hours. Ustvarite prvega!</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Naziv', 'Dnevi', 'Čas', 'Popust', 'Storitve', 'Status', 'Akcije'].map((h) => (
                  <th key={h} className={`py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider ${h === 'Akcije' ? 'text-right' : 'text-left'}`}>{h}</th>
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
                          <span key={d} className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">{DAYS_SL[d]}</span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-gray-600">{hh.cas_zacetek?.substring(0, 5)} – {hh.cas_konec?.substring(0, 5)}</td>
                    <td className="py-3.5 px-4 font-semibold text-gray-900">{hh.tip_popusta === 'percentage' ? `${hh.vrednost}%` : `${hh.vrednost} €`}</td>
                    <td className="py-3.5 px-4">
                      {hh.vse_storitve
                        ? <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">Vse</span>
                        : <span className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full text-xs">{(hh.storitev_ids || []).length}</span>
                      }
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${hh.aktiven ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{hh.aktiven ? 'Aktiven' : 'Neaktiven'}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleToggleActive(hh)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${hh.aktiven ? 'bg-gray-900' : 'bg-gray-300'}`}>
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${hh.aktiven ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
                        </button>
                        <button onClick={() => openEdit(hh)} className="p-1.5 text-gray-400 hover:text-violet-600 transition-colors rounded-lg hover:bg-violet-50"><PencilSimple className="w-4 h-4" weight="regular" /></button>
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
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">{editingId ? 'Uredi Happy Hour' : 'Nov Happy Hour'}</h2>
                <button onClick={() => setModalOpen(false)} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"><X className="w-5 h-5" weight="bold" /></button>
              </div>

              <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Naziv</label>
                  <input value={form.naziv} onChange={(e) => setForm((p) => ({ ...p, naziv: e.target.value }))} placeholder="Npr. Popoldanski Happy Hour" className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" />
                </div>

                {/* Days */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Dnevi v tednu</label>
                  <div className="flex gap-1.5">
                    {DAYS_SL.map((label, idx) => (
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
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Čas od</label>
                    <input type="time" value={form.cas_zacetek} onChange={(e) => setForm((p) => ({ ...p, cas_zacetek: e.target.value }))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Čas do</label>
                    <input type="time" value={form.cas_konec} onChange={(e) => setForm((p) => ({ ...p, cas_konec: e.target.value }))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" />
                  </div>
                </div>

                {/* Tip + vrednost */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Tip popusta</label>
                  <div className="flex gap-3 mb-3">
                    {([['percentage', 'Odstotek (%)'], ['fixed', 'Fiksni znesek (€)']] as const).map(([val, label]) => (
                      <label key={val} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" checked={form.tip_popusta === val} onChange={() => setForm((p) => ({ ...p, tip_popusta: val }))} className="accent-violet-600" />
                        <span className="text-sm text-gray-700">{label}</span>
                      </label>
                    ))}
                  </div>
                  <input type="number" min="0" max={form.tip_popusta === 'percentage' ? 100 : undefined} step="0.01" value={form.vrednost} onChange={(e) => setForm((p) => ({ ...p, vrednost: e.target.value }))} placeholder={form.tip_popusta === 'percentage' ? '20' : '5.00'} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" />
                </div>

                {/* Storitve */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500">Storitve</label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.vse_storitve} onChange={() => setForm((p) => ({ ...p, vse_storitve: !p.vse_storitve }))} className="accent-violet-600" />
                      <span className="text-xs text-gray-600">Vse storitve</span>
                    </label>
                  </div>
                  {!form.vse_storitve && (
                    <>
                      <div className="relative mb-2">
                        <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" weight="regular" />
                        <input value={serviceSearch} onChange={(e) => setServiceSearch(e.target.value)} placeholder="Iskanje..." className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" />
                      </div>
                      {form.storitev_ids.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {form.storitev_ids.map((id) => (
                            <span key={id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-violet-100 text-violet-700 rounded-full text-xs font-medium">
                              {getServiceName(id)}
                              <button onClick={() => toggleService(id)}><X className="w-3 h-3" weight="bold" /></button>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="max-h-36 overflow-y-auto space-y-1 border border-gray-100 rounded-xl p-2">
                        {filteredServices.map((svc) => {
                          const naziv = (() => { const r = svc as unknown as Record<string, unknown>; return String(r['Naziv'] ?? r['naziv'] ?? svc.naziv ?? svc.id); })();
                          const selected = form.storitev_ids.includes(svc.id);
                          return (
                            <button key={svc.id} onClick={() => toggleService(svc.id)} className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${selected ? 'bg-violet-50 text-violet-700' : 'hover:bg-gray-50 text-gray-700'}`}>
                              <span>{naziv}</span>
                              {selected && <span className="text-violet-500 text-xs font-medium">✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <span className="text-sm font-medium text-gray-700">Aktiven</span>
                  <button onClick={() => setForm((p) => ({ ...p, aktiven: !p.aktiven }))} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.aktiven ? 'bg-gray-900' : 'bg-gray-300'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.aktiven ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                <button onClick={() => setModalOpen(false)} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">Prekliči</button>
                <motion.button whileTap={{ scale: 0.98 }} onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-xl disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #6D5EF7 0%, #2F80ED 100%)' }}>
                  {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {editingId ? 'Shrani' : 'Ustvari'}
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
              <p className="text-base font-semibold text-gray-900 mb-2">Izbriši Happy Hour?</p>
              <p className="text-sm text-gray-500 mb-5">Tega dejanja ni mogoče razveljaviti.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Prekliči</button>
                <button onClick={() => deleteId && handleDelete(deleteId)} className="flex-1 py-2.5 rounded-xl bg-red-500 text-sm font-medium text-white hover:bg-red-600 transition-colors">Izbriši</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
