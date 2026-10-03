'use client';

/**
 * ZAČASNA predogledna stran za okenca za brisanje.
 * Ko je redizajn potrjen, se mapa `design` zbriše.
 */

import { useState } from 'react';
import DeleteClientModal from '@/components/clients/DeleteClientModal';
import DeleteServiceModal from '@/components/services/DeleteServiceModal';
import DeleteEmployeeModal from '@/components/employees/DeleteEmployeeModal';
import DeleteResursModal from '@/components/resursi/DeleteResursModal';
import DeleteConfirmation from '@/components/appointments/DeleteConfirmation';
import type { Client } from '@/types/clients';
import type { Service } from '@/types/services';
import type { Employee } from '@/types/employees';
import type { Resurs } from '@/types/resursi';
import type { AppointmentWithDetails } from '@/types/appointments';
import { SERVICE_GRADIENTS } from '@/lib/constants/serviceGradients';
import { EMPLOYEE_GRADIENTS } from '@/lib/constants/gradients';

const base = { podjetje_id: 'preview', created_at: '2025-03-14T10:00:00Z', updated_at: '2025-09-01T10:00:00Z' };

const CLIENT: Client = {
  id: '1', ime: 'Ana', priimek: 'Kovač', spol: 'ženska', tip_stranke: 'vip', language: 'slo',
  email: 'ana.kovac@example.com', telefon: '041 234 567', opombe: null, interne_opombe: null,
  created_at: base.created_at, appointment_count: 24,
};

const SERVICE: Service = {
  ...base, id: 's1', naziv: 'Žensko striženje', kategorija: 'Striženje', barva: SERVICE_GRADIENTS[3].gradient,
  trajanje: 45, buffer_pred: 0, buffer_po: 10, skupni_cas: 55, tip_cene: 'fiksna', cena: 35, currency: 'EUR',
  opis: null, aktivna: true, spletne_rezervacije: true, zahteva_placilo: false,
};

const EMPLOYEE: Employee = {
  ...base, id: 'e1', ime: 'Maja', priimek: 'Novak', email: 'maja.novak@example.com',
  pozicija: 'Vodja salona', barva: EMPLOYEE_GRADIENTS[2].value, aktivna: true,
};

const RESURS: Resurs = {
  id: 'r1', row_id: 1, naziv: 'Frizerski stol', booking_naziv: 'Stol', opis: null, kolicina: 3, kapaciteta: 1,
  prikazi_v_bookingu: true, urnik: null, status: 'active', barva: SERVICE_GRADIENTS[1].gradient,
  podjetje_id: 'preview', created_at: base.created_at,
};

const APPOINTMENT = {
  id: 'a1', datum: '2026-10-09', cas_zacetek: '15:00:00', stranka_ime: 'Ana Kovač', stranka_email: 'ana.kovac@example.com',
  storitev: { naziv: 'Žensko striženje' }, add_on_naziv: 'Nega las z masko', zaposleni: { ime: 'Maja', priimek: 'Novak' },
} as unknown as AppointmentWithDetails;

type Open = 'client' | 'service' | 'service-busy' | 'employee' | 'resurs' | 'appointment' | 'generic' | null;

export default function OkencaBrisanjePreview() {
  const [open, setOpen] = useState<Open>('appointment');
  const close = () => setOpen(null);
  const done = async () => close();
  const btn = 'rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-900';

  const buttons: [Open, string][] = [
    ['appointment', 'Termin'], ['generic', 'Splošno'], ['client', 'Stranka'], ['service', 'Storitev'],
    ['service-busy', 'Storitev s termini'], ['employee', 'Zaposleni'], ['resurs', 'Resurs'],
  ];

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
          predogled
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">Okenca — brisanje</h1>
        <p className="mt-0.5 mb-6 text-base text-gray-500">Vse potrditve brisanja v enaki obliki.</p>
        <div className="flex flex-wrap gap-2">
          {buttons.map(([key, label]) => (
            <button key={key} type="button" onClick={() => setOpen(key)} className={btn}>{label}</button>
          ))}
        </div>
      </div>

      <DeleteConfirmation
        isOpen={open === 'appointment' || open === 'generic'}
        onClose={close}
        onConfirm={close}
        title={open === 'generic' ? 'Izbriši zapis' : 'Izbriši termin'}
        message={open === 'generic' ? 'Zapis bo trajno odstranjen.' : 'Termin bo odstranjen iz koledarja, stranka ne bo prejela obvestila.'}
        itemName={open === 'generic' ? 'Božična promocija 2026' : undefined}
        appointment={open === 'appointment' ? APPOINTMENT : null}
      />
      <DeleteClientModal isOpen={open === 'client'} onClose={close} client={CLIENT} onConfirm={done} />
      <DeleteServiceModal
        isOpen={open === 'service' || open === 'service-busy'}
        onClose={close}
        service={SERVICE}
        appointmentCount={open === 'service-busy' ? 12 : 0}
        onConfirm={done}
        onDeactivate={done}
      />
      <DeleteEmployeeModal isOpen={open === 'employee'} employee={EMPLOYEE} onClose={close} onConfirm={done} />
      <DeleteResursModal isOpen={open === 'resurs'} onClose={close} resurs={RESURS} onConfirm={done} />
    </main>
  );
}
