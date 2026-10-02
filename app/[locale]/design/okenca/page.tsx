'use client';

/**
 * ZAČASNA predogledna stran za okenca.
 *
 * Odpre pravo okence termina (AppointmentDetailModal) s termini, ki imajo
 * izpolnjen vsak podatek, in z različicami (happy hour, zaključen, nebeležen,
 * brez kontakta). Ko je redizajn potrjen, se mapa `design` zbriše.
 */

import { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { AppointmentDetailModal } from '@/components/calendar/AppointmentDetailSheet';
import type { AppointmentWithDetails, Storitev } from '@/types/appointments';
import type { Resurs } from '@/types/resursi';

const G = {
  violet: 'linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)',
  pink: 'linear-gradient(135deg, #EC4899 0%, #F97316 100%)',
  green: 'linear-gradient(135deg, #10B981 0%, #3B82F6 100%)',
  amber: 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)',
};

const SERVICES: Storitev[] = [
  { id: 's1', naziv: 'Barvanje in fen', barva: G.violet, trajanje: 75, cena: 55 },
  { id: 's2', naziv: 'Pramenčki', barva: G.pink, trajanje: 45, cena: 40 },
  { id: 's3', naziv: 'Nega las s keratinom', barva: G.green, trajanje: 30, cena: 25 },
  { id: 's4', naziv: 'Masaža lasišča', barva: G.amber, trajanje: 15, cena: 12 },
];

const RESURSI: Resurs[] = [
  { id: 'r1', row_id: 1, naziv: 'Frizerski stol 2', booking_naziv: null, opis: null, kolicina: 4, kapaciteta: 1,
    prikazi_v_bookingu: true, urnik: null, status: 'active', barva: G.violet, podjetje_id: 'p', created_at: '' },
  { id: 'r2', row_id: 2, naziv: 'Pralna postaja', booking_naziv: null, opis: null, kolicina: 2, kapaciteta: 1,
    prikazi_v_bookingu: true, urnik: null, status: 'active', barva: G.green, podjetje_id: 'p', created_at: '' },
];

const today = new Date().toISOString().split('T')[0];

const FULL: AppointmentWithDetails = {
  id: '101',
  id_termina: 'T-48291037',
  datum: today,
  cas_zacetek: '10:00',
  cas_konec: '12:45',
  stranka_id: 'c1',
  stranka_ime: 'Ana Kovač',
  stranka_priimek: 'Kovač',
  stranka_email: 'ana.kovac@example.com',
  stranka_telefon: '041 234 567',
  language: 'slo',
  storitev_id: 's1',
  storitev_id_2: 's2',
  storitev_id_3: 's3',
  add_on_storitev_id: 's4',
  add_on_naziv: 'Masaža lasišča',
  add_on_trajanje: 15,
  add_on_popust: '20',
  add_on_popust_tip: '%',
  add_on_final_cena: '9.60',
  zaposleni_id: 'e1',
  status: 'scheduled',
  opombe: 'Želi nekoliko toplejši odtenek kot zadnjič. Alergija na amonijak.',
  interne_opombe: 'Stalna stranka, rada se pogovarja o vrtnarjenju. Zadnjič zamudila 10 min.',
  cena: 120,
  popust: 15,
  popust_tip: 'percent',
  koncna_cena: 102,
  promocija_tip: 'popust',
  promocija_naziv: 'Jesenska akcija',
  popust_id: 'p1',
  valuta: 'EUR',
  belezi_termin: true,
  storitev: { id: 's1', naziv: 'Barvanje in fen', barva: G.violet, trajanje: 75, cena: 55 },
  storitev_2: { id: 's2', naziv: 'Pramenčki', barva: G.pink, trajanje: 45 },
  storitev_3: { id: 's3', naziv: 'Nega las s keratinom', barva: G.green, trajanje: 30 },
  add_on_storitev: { id: 's4', naziv: 'Masaža lasišča', barva: G.amber, trajanje: 15 },
  zaposleni: { id: 'e1', ime: 'Maja', priimek: 'Novak', email: 'maja@example.com', initials: 'MN', barva: G.violet },
};

const SCENARIJI: { id: string; naslov: string; opis: string; apt: AppointmentWithDetails }[] = [
  { id: 'full', naslov: 'Vsi podatki', opis: '3 storitve, dodatek s popustom, akcija, opombe, resursi, ID', apt: FULL },
  {
    id: 'happy', naslov: 'Happy hour', opis: 'Ena storitev, popust v evrih', apt: {
      ...FULL, id: '102', id_termina: 'T-11223344', stranka_ime: 'Marko Zupan', stranka_email: 'marko@example.com',
      cas_zacetek: '15:00', cas_konec: '15:45', storitev_id_2: undefined, storitev_id_3: undefined, storitev_2: null, storitev_3: null,
      add_on_storitev_id: null, add_on_naziv: null, add_on_final_cena: null, add_on_storitev: null,
      storitev: { id: 's2', naziv: 'Pramenčki', barva: G.pink, trajanje: 45, cena: 40 }, storitev_id: 's2',
      cena: 40, popust: 5, popust_tip: 'eur', koncna_cena: 35, promocija_tip: 'happy_hour', promocija_naziv: 'Popoldanska ura',
      opombe: undefined, interne_opombe: undefined, language: 'eng',
    },
  },
  {
    id: 'done', naslov: 'Zaključen', opis: 'Brez popusta, gumb Zaključi se skrije', apt: {
      ...FULL, id: '103', id_termina: 'T-55667788', status: 'completed', stranka_ime: 'Luka Horvat',
      storitev_id_2: undefined, storitev_id_3: undefined, storitev_2: null, storitev_3: null,
      add_on_storitev_id: null, add_on_naziv: null, add_on_final_cena: null, add_on_storitev: null,
      cena: 55, popust: null, popust_tip: null, koncna_cena: 55, promocija_tip: null, promocija_naziv: null,
      interne_opombe: undefined,
    },
  },
  {
    id: 'ghost', naslov: 'Nebeležen termin', opis: 'Ne šteje v analitiko; brez kontakta stranke', apt: {
      ...FULL, id: '104', id_termina: 'T-99001122', belezi_termin: false, stranka_ime: 'Interni termin',
      stranka_email: undefined, stranka_telefon: undefined, stranka_id: undefined,
      storitev_id_2: undefined, storitev_id_3: undefined, storitev_2: null, storitev_3: null,
      add_on_storitev_id: null, add_on_naziv: null, add_on_final_cena: null, add_on_storitev: null,
      cena: 0, popust: null, koncna_cena: 0, promocija_tip: null, opombe: 'Izobraževanje nove sodelavke.', interne_opombe: undefined,
    },
  },
];

export default function OkencaDesignPreview() {
  const [open, setOpen] = useState<string | null>('full');
  const current = SCENARIJI.find((x) => x.id === open);

  // Resurs 1 in 2 sta zasedena s polnim terminom, da se skupina pokaže.
  const terminResursiMap = new Map<number, Set<number>>([
    [1, new Set([101, 102])],
    [2, new Set([101])],
  ]);

  const noop = () => {};

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
          predogled
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">Okenca — termin</h1>
        <p className="mt-0.5 mb-6 text-base text-gray-500">
          Isto okence je zdaj v Koledarju, na nadzorni plošči in v Terminih.
        </p>

        <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wider text-gray-500">Primeri</h2>
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
          {SCENARIJI.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setOpen(x.id)}
              className="flex w-full items-center justify-between gap-4 border-b border-gray-100 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-gray-50"
            >
              <span>
                <span className="block text-sm font-medium text-gray-900">{x.naslov}</span>
                <span className="block text-[13px] text-gray-500">{x.opis}</span>
              </span>
              <span className="text-[13px] font-medium text-[#7C78FA]">Odpri</span>
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {current && (
          <AppointmentDetailModal
            key={current.id}
            appointment={current.apt}
            services={SERVICES}
            terminResursiMap={terminResursiMap}
            activeResursi={RESURSI}
            onClose={() => setOpen(null)}
            onEdit={noop}
            onComplete={noop}
            onNoShow={noop}
            onCancel={noop}
            onDelete={noop}
            onOpenClientDetails={current.apt.stranka_id ? noop : undefined}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
