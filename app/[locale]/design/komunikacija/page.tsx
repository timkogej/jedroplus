'use client';

/**
 * ZAČASNA predogledna stran za redizajn Komunikacije.
 *
 * Uporablja prave komponente (CustomerList, AIMessageGenerator, Composer,
 * Preview, SendSection) z izmišljenimi strankami. Ko je redizajn potrjen, se
 * mapa `design` zbriše.
 */

import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, CaretRight } from '@phosphor-icons/react';
import CustomerList from '@/components/komunikacija/CustomerList';
import AIMessageGenerator from '@/components/komunikacija/AIMessageGenerator';
import MessageComposer from '@/components/komunikacija/MessageComposer';
import MessagePreview from '@/components/komunikacija/MessagePreview';
import SendSection from '@/components/komunikacija/SendSection';

const NAMES = [
  'Ana Kovač', 'Marko Zupan', 'Luka Horvat', 'Nina Bizjak', 'Tomaž Krajnc',
  'Jure Potočnik', 'Eva Zajc', 'Rok Mlakar', 'Blaž Kralj', 'Nejc Vidic',
  'Urša Jereb', 'Katja Bevk', 'Sara Lah', 'Miha Oblak', 'Petra Golob',
];

function iso(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

const CUSTOMERS = NAMES.map((name, i) => {
  const [first, last] = name.split(' ');
  // Razpršimo termine čez danes, jutri, ta teden in ta mesec, da imajo
  // gumbi skupin smiselna števila.
  const offset = [0, 1, 3, 12, 0, 1, 5, 20, 0, 2, 9, 25, 1, 4, 18][i];
  return {
    id: String(i + 1),
    name,
    email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
    phone: `041${200 + i}${300 + i}`,
    nextAppointment: `${iso(offset)}T09:00:00`,
    lastVisit: iso(-30),
    tags: [],
    appointmentDates: [iso(offset)],
  };
});

export default function KomunikacijaDesignPreview() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(['1', '2', '5', '9']));
  const [subject, setSubject] = useState('Poletna akcija v salonu');
  const [message, setMessage] = useState(
    'Pozdravljeni {{ime}},\n\nta mesec imamo 20 % popusta na barvanje. Se vidimo!',
  );
  const [step, setStep] = useState<1 | 2>(1);

  const selectedNames = useMemo(
    () => CUSTOMERS.filter((c) => selectedIds.has(c.id)).map((c) => c.name),
    [selectedIds],
  );

  const audience = (
    <CustomerList
      customers={CUSTOMERS}
      selectedIds={selectedIds}
      onSelectionChange={setSelectedIds}
    />
  );

  const composer = (
    <div className="space-y-4">
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-gray-100 bg-white p-3">
          <span className="text-[13px] text-gray-500">Prejemniki:</span>
          {selectedNames.slice(0, 3).map((name) => (
            <span key={name} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[13px] font-medium text-gray-700">
              {name}
            </span>
          ))}
          {selectedNames.length > 3 && (
            <span className="tnum rounded-full bg-gray-100 px-2.5 py-0.5 text-[13px] font-medium text-gray-700">
              +{selectedNames.length - 3}
            </span>
          )}
        </div>
      )}

      <AIMessageGenerator onGenerate={() => {}} />

      <div className="rounded-xl border border-gray-100 bg-white p-4">
        <MessageComposer
          subject={subject}
          onSubjectChange={setSubject}
          message={message}
          onMessageChange={setMessage}
        />
      </div>

      <MessagePreview subject={subject} message={message} senderName="Salon Jedro" defaultOpen />

      <SendSection
        selectedCount={selectedIds.size}
        remainingQuota={372}
        hasMessage={message.trim().length > 0}
        hasSubject={subject.trim().length > 0}
        onSend={() => {}}
      />
    </div>
  );

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
          className="mb-7 flex flex-wrap items-start justify-between gap-4"
        >
          <div>
            <div className="mb-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
              predogled
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">Komunikacija</h1>
            <p className="mt-0.5 text-base text-gray-500">Skupinsko sporočilo strankam.</p>
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="text-[13px] text-gray-500">Porabljeni e-maili</p>
            <p className="tnum mt-0.5 text-sm font-medium">
              <span className="text-gray-900">128</span>
              <span className="text-gray-400"> / 500</span>
            </p>
          </div>
        </motion.div>

        <div className="hidden lg:grid lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-6">
          <div className="flex max-h-[calc(100vh-11rem)] flex-col lg:sticky lg:top-6">
            <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wider text-gray-500">
              Komu
            </h2>
            {audience}
          </div>
          <div className="min-w-0">
            <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wider text-gray-500">
              Sporočilo
            </h2>
            {composer}
          </div>
        </div>

        <div className="lg:hidden">
          {step === 1 ? (
            <div className="flex max-h-[calc(100vh-13rem)] flex-col">
              {audience}
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={selectedIds.size === 0}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:bg-none disabled:bg-gray-100 disabled:text-gray-400 disabled:shadow-none"
              >
                Naprej ({selectedIds.size})
                <CaretRight className="h-3.5 w-3.5" weight="bold" />
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
              >
                <ArrowLeft className="h-3.5 w-3.5" weight="regular" />
                Nazaj
              </button>
              {composer}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
