'use client';

/**
 * ZAČASNA predogledna stran za okenca storitve, zaposlenega in resursa.
 * Ko je redizajn potrjen, se mapa `design` zbriše.
 */

import { useState } from 'react';
import ServiceModal from '@/components/services/ServiceModal';
import EmployeeModal from '@/components/employees/EmployeeModal';
import ResursModal from '@/components/resursi/ResursModal';
import type { Service } from '@/types/services';
import type { Employee } from '@/types/employees';
import type { Resurs } from '@/types/resursi';
import { DEFAULT_URNIK } from '@/types/resursi';
import { SERVICE_GRADIENTS } from '@/lib/constants/serviceGradients';
import { EMPLOYEE_GRADIENTS } from '@/lib/constants/gradients';

const G1 = SERVICE_GRADIENTS[3].gradient;
const G2 = SERVICE_GRADIENTS[1].gradient;

const base = { podjetje_id: 'preview', created_at: '2025-03-14T10:00:00Z', updated_at: '2025-09-01T10:00:00Z' };

const SERVICES: Service[] = [
  { ...base, id: 's1', naziv: 'Žensko striženje', kategorija: 'Striženje', barva: G1, trajanje: 45, buffer_pred: 0, buffer_po: 10, skupni_cas: 55, tip_cene: 'fiksna', cena: 35, currency: 'EUR', opis: 'Striženje, umivanje in feniranje.', aktivna: true, spletne_rezervacije: true, zahteva_placilo: true },
  { ...base, id: 's2', naziv: 'Barvanje las', kategorija: 'Barvanje', barva: G2, trajanje: 90, buffer_pred: 0, buffer_po: 15, skupni_cas: 105, tip_cene: 'fiksna', cena: 65, currency: 'EUR', opis: null, aktivna: true, spletne_rezervacije: true, zahteva_placilo: false },
  { ...base, id: 's3', naziv: 'Moško striženje', kategorija: 'Striženje', barva: G1, trajanje: 30, buffer_pred: 0, buffer_po: 0, skupni_cas: 30, tip_cene: 'fiksna', cena: 20, currency: 'EUR', opis: null, aktivna: true, spletne_rezervacije: false, zahteva_placilo: false },
];

const EMPLOYEE: Employee = {
  ...base, id: 'e1', ime: 'Maja', priimek: 'Novak', email: 'maja.novak@example.com', telefon: '041 555 123',
  pozicija: 'Vodja salona', barva: EMPLOYEE_GRADIENTS[2].value, aktivna: true, opombe: 'Ob petkih dela samo dopoldne.',
};

const RESURSI: Resurs[] = [
  { id: 'r1', row_id: 1, naziv: 'Frizerski stol', booking_naziv: 'Stol', opis: 'Hidravlični stoli v glavnem prostoru.', kolicina: 3, kapaciteta: 1, prikazi_v_bookingu: true, urnik: DEFAULT_URNIK, status: 'active', barva: G2, podjetje_id: 'preview', created_at: base.created_at },
  { id: 'r2', row_id: 2, naziv: 'Umivalnik', booking_naziv: null, opis: null, kolicina: 2, kapaciteta: 1, prikazi_v_bookingu: false, urnik: null, status: 'active', barva: G1, podjetje_id: 'preview', created_at: base.created_at },
];

type Open = 'service' | 'service-new' | 'employee' | 'employee-new' | 'resurs' | 'resurs-new' | null;

export default function OkencaKatalogPreview() {
  const [open, setOpen] = useState<Open>('service');
  const [linked, setLinked] = useState<string[]>(['r1']);
  const close = () => setOpen(null);
  const btn = 'rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-900';

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
          predogled
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">Okenca — storitev, zaposleni, resurs</h1>
        <p className="mt-0.5 mb-6 text-base text-gray-500">Obrazci za novo / urejanje s polnimi podatki.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setOpen('service')} className={btn}>Uredi storitev</button>
          <button type="button" onClick={() => setOpen('service-new')} className={btn}>Nova storitev</button>
          <button type="button" onClick={() => setOpen('employee')} className={btn}>Uredi zaposlenega</button>
          <button type="button" onClick={() => setOpen('employee-new')} className={btn}>Nov zaposleni</button>
          <button type="button" onClick={() => setOpen('resurs')} className={btn}>Uredi resurs</button>
          <button type="button" onClick={() => setOpen('resurs-new')} className={btn}>Nov resurs</button>
        </div>
      </div>

      <ServiceModal
        isOpen={open === 'service' || open === 'service-new'}
        onClose={close}
        service={open === 'service' ? SERVICES[0] : null}
        mode={open === 'service' ? 'edit' : 'create'}
        onSave={async () => close()}
        currency="EUR"
        existingCategories={['Striženje', 'Barvanje', 'Nega']}
        availableResursi={RESURSI}
        linkedResursiIds={linked}
        onLinkedResursiChange={setLinked}
        paymentRequirementAvailable
        paymentRequirementChecks={{ hasProPlan: true, hasPosSubscription: true, stripeEnabled: true }}
      />
      <EmployeeModal
        isOpen={open === 'employee' || open === 'employee-new'}
        onClose={close}
        employee={open === 'employee' ? EMPLOYEE : null}
        mode={open === 'employee' ? 'edit' : 'create'}
        companyId="preview"
        onSave={async () => close()}
      />
      <ResursModal
        isOpen={open === 'resurs' || open === 'resurs-new'}
        onClose={close}
        resurs={open === 'resurs' ? RESURSI[0] : null}
        mode={open === 'resurs' ? 'edit' : 'create'}
        services={SERVICES}
        onSave={async () => close()}
        linkedStoritevIds={['s1', 's3']}
      />
    </main>
  );
}
