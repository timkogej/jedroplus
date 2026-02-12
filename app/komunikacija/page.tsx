'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Envelope,
  PaperPlaneTilt,
  Users,
  CheckCircle,
  X,
  Warning,
  ArrowLeft,
} from '@phosphor-icons/react';
import ProtectedLayout from '@/components/ProtectedLayout';
import EmailQuotaCard from '@/components/komunikacija/EmailQuotaCard';
import CustomerList from '@/components/komunikacija/CustomerList';
import AIMessageGenerator from '@/components/komunikacija/AIMessageGenerator';
import MessageComposer from '@/components/komunikacija/MessageComposer';
import MessagePreview from '@/components/komunikacija/MessagePreview';
import SendSection from '@/components/komunikacija/SendSection';

// ============================================================================
// Mock data
// ============================================================================

const mockCustomers = [
  {
    id: '1',
    name: 'Janez Novak',
    email: 'janez.novak@email.com',
    phone: '+386 41 123 456',
    nextAppointment: '2025-02-15T14:00:00',
    lastVisit: '2025-02-08',
    tags: ['VIP', 'Redna stranka'],
  },
  {
    id: '2',
    name: 'Maja Horvat',
    email: 'maja.horvat@email.com',
    phone: '+386 40 987 654',
    nextAppointment: null,
    lastVisit: '2024-12-20',
    tags: ['Nova stranka'],
  },
  {
    id: '3',
    name: 'Luka Krajnc',
    email: 'luka.krajnc@email.com',
    phone: '+386 31 456 789',
    nextAppointment: '2025-02-11T10:00:00',
    lastVisit: '2025-02-04',
    tags: ['Redna stranka'],
  },
  {
    id: '4',
    name: 'Ana Zupan',
    email: 'ana.zupan@email.com',
    phone: '+386 51 234 567',
    nextAppointment: '2025-02-12T16:30:00',
    lastVisit: '2025-01-28',
    tags: ['VIP'],
  },
  {
    id: '5',
    name: 'Marko Potočnik',
    email: 'marko.potocnik@email.com',
    phone: '+386 41 876 543',
    nextAppointment: '2025-02-14T09:00:00',
    lastVisit: '2025-02-01',
    tags: [],
  },
  {
    id: '6',
    name: 'Nina Kovač',
    email: 'nina.kovac@email.com',
    phone: '+386 40 112 233',
    nextAppointment: null,
    lastVisit: '2024-11-15',
    tags: ['Neaktivna'],
  },
  {
    id: '7',
    name: 'Tomaž Vidmar',
    email: 'tomaz.vidmar@email.com',
    phone: '+386 31 998 877',
    nextAppointment: '2025-02-11T11:30:00',
    lastVisit: '2025-02-07',
    tags: ['Redna stranka'],
  },
  {
    id: '8',
    name: 'Eva Kavčič',
    email: 'eva.kavcic@email.com',
    phone: '+386 51 445 566',
    nextAppointment: '2025-02-13T13:00:00',
    lastVisit: '2025-01-20',
    tags: ['Nova stranka'],
  },
  {
    id: '9',
    name: 'Gregor Mlakar',
    email: 'gregor.mlakar@email.com',
    phone: '+386 41 667 788',
    nextAppointment: null,
    lastVisit: '2025-01-10',
    tags: [],
  },
  {
    id: '10',
    name: 'Petra Kos',
    email: 'petra.kos@email.com',
    phone: '+386 40 334 455',
    nextAppointment: '2025-02-18T15:00:00',
    lastVisit: '2025-02-05',
    tags: ['VIP', 'Redna stranka'],
  },
  {
    id: '11',
    name: 'Rok Oblak',
    email: 'rok.oblak@email.com',
    phone: '+386 31 221 334',
    nextAppointment: '2025-02-12T10:00:00',
    lastVisit: '2025-01-30',
    tags: ['Redna stranka'],
  },
  {
    id: '12',
    name: 'Tina Šuštar',
    email: 'tina.sustar@email.com',
    phone: '+386 51 778 899',
    nextAppointment: null,
    lastVisit: '2024-12-05',
    tags: ['Neaktivna'],
  },
  {
    id: '13',
    name: 'Matej Bizjak',
    email: 'matej.bizjak@email.com',
    phone: '+386 41 556 677',
    nextAppointment: '2025-02-11T14:30:00',
    lastVisit: '2025-02-06',
    tags: [],
  },
  {
    id: '14',
    name: 'Klara Turk',
    email: 'klara.turk@email.com',
    phone: '+386 40 889 990',
    nextAppointment: '2025-02-16T11:00:00',
    lastVisit: '2025-01-25',
    tags: ['Nova stranka'],
  },
  {
    id: '15',
    name: 'Simon Golob',
    email: 'simon.golob@email.com',
    phone: '+386 31 112 223',
    nextAppointment: '2025-02-19T09:30:00',
    lastVisit: '2025-02-03',
    tags: ['Redna stranka'],
  },
];

const mockQuota = {
  used: 847,
  total: 1000,
  resetDate: '1. mar 2025',
};

// ============================================================================
// Toast component
// ============================================================================

function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 50, scale: 0.9 }}
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg ${
        type === 'success'
          ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white'
          : 'bg-gradient-to-r from-red-500 to-rose-500 text-white'
      }`}
    >
      {type === 'success' ? (
        <CheckCircle className="h-5 w-5" weight="fill" />
      ) : (
        <Warning className="h-5 w-5" weight="fill" />
      )}
      <span className="text-sm font-medium">{message}</span>
      <button
        type="button"
        onClick={onClose}
        className="ml-2 rounded-full p-0.5 transition-colors hover:bg-white/20"
      >
        <X className="h-4 w-4" weight="bold" />
      </button>
    </motion.div>
  );
}

// ============================================================================
// Mobile view enum
// ============================================================================

type MobileView = 'customers' | 'composer';

// ============================================================================
// Page
// ============================================================================

export default function KomunikacijaPage() {
  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Message state
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Mobile view
  const [mobileView, setMobileView] = useState<MobileView>('customers');

  // Handlers
  const handleAIGenerate = useCallback((generatedMessage: string) => {
    setMessage(generatedMessage);
  }, []);

  const handleSend = useCallback(() => {
    console.log('Sending email to:', Array.from(selectedIds));
    console.log('Subject:', subject);
    console.log('Message:', message);

    setToast({
      message: `Sporočilo uspešno poslano ${selectedIds.size} strankam!`,
      type: 'success',
    });

    // Reset form
    setTimeout(() => {
      setSelectedIds(new Set());
      setSubject('');
      setMessage('');
    }, 500);
  }, [selectedIds, subject, message]);

  const remaining = mockQuota.total - mockQuota.used;

  return (
    <ProtectedLayout>
      <main className="min-h-screen bg-[#F7F8FA]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
          {/* Page Header */}
          <div className="mb-6">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 mb-1"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 shadow-md shadow-violet-500/20">
                <Envelope className="h-5 w-5 text-white" weight="fill" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-[#1A1F36]">
                  Komunikacija
                </h1>
                <p className="text-sm text-gray-500">
                  Pošljite sporočila svojim strankam hitro in enostavno
                </p>
              </div>
            </motion.div>
          </div>

          {/* Email Quota */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-6"
          >
            <EmailQuotaCard
              used={mockQuota.used}
              total={mockQuota.total}
              resetDate={mockQuota.resetDate}
            />
          </motion.div>

          {/* Mobile View Switcher */}
          <div className="flex lg:hidden mb-4">
            <div className="flex w-full rounded-xl bg-white border border-gray-200 p-1">
              <button
                type="button"
                onClick={() => setMobileView('customers')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  mobileView === 'customers'
                    ? 'bg-gradient-to-r from-violet-500 to-cyan-500 text-white shadow-md'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Users className="h-4 w-4" weight={mobileView === 'customers' ? 'fill' : 'regular'} />
                Stranke
                {selectedIds.size > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                    mobileView === 'customers'
                      ? 'bg-white/20'
                      : 'bg-violet-50 text-violet-600'
                  }`}>
                    {selectedIds.size}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setMobileView('composer')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  mobileView === 'composer'
                    ? 'bg-gradient-to-r from-violet-500 to-cyan-500 text-white shadow-md'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <PaperPlaneTilt className="h-4 w-4" weight={mobileView === 'composer' ? 'fill' : 'regular'} />
                Sporočilo
              </button>
            </div>
          </div>

          {/* Main Content - Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column - Customer Selection */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className={`lg:col-span-5 ${mobileView !== 'customers' ? 'hidden lg:block' : ''}`}
            >
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="h-5 w-5 text-[#1A1F36]" weight="bold" />
                  <h2 className="text-lg font-semibold text-[#1A1F36]">
                    Izbira strank
                  </h2>
                </div>
                <CustomerList
                  customers={mockCustomers}
                  selectedIds={selectedIds}
                  onSelectionChange={setSelectedIds}
                />
              </div>

              {/* Mobile: continue to composer button */}
              {selectedIds.size > 0 && (
                <div className="lg:hidden mt-4">
                  <motion.button
                    type="button"
                    onClick={() => setMobileView('composer')}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-semibold text-sm shadow-lg shadow-violet-500/20 flex items-center justify-center gap-2"
                  >
                    Nadaljuj s {selectedIds.size} {selectedIds.size === 1 ? 'stranko' : 'strankami'}
                    <PaperPlaneTilt className="h-4 w-4" weight="fill" />
                  </motion.button>
                </div>
              )}
            </motion.div>

            {/* Right Column - Message Composer */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className={`lg:col-span-7 ${mobileView !== 'composer' ? 'hidden lg:block' : ''}`}
            >
              <div className="space-y-5">
                {/* Mobile: back button */}
                <button
                  type="button"
                  onClick={() => setMobileView('customers')}
                  className="lg:hidden flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors -mt-1 mb-1"
                >
                  <ArrowLeft className="h-4 w-4" weight="bold" />
                  Nazaj na stranke
                </button>

                {/* Composer card */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-5">
                    <PaperPlaneTilt className="h-5 w-5 text-[#1A1F36]" weight="bold" />
                    <h2 className="text-lg font-semibold text-[#1A1F36]">
                      Sestavi sporočilo
                    </h2>
                  </div>

                  {/* AI Generator */}
                  <div className="mb-6">
                    <AIMessageGenerator onGenerate={handleAIGenerate} />
                  </div>

                  {/* Message Composer */}
                  <MessageComposer
                    subject={subject}
                    onSubjectChange={setSubject}
                    message={message}
                    onMessageChange={setMessage}
                  />
                </div>

                {/* Preview */}
                <MessagePreview
                  subject={subject}
                  message={message}
                  senderName="Moje Podjetje"
                />

                {/* Send Section */}
                <SendSection
                  selectedCount={selectedIds.size}
                  remainingQuota={remaining}
                  hasMessage={message.trim().length > 0}
                  hasSubject={subject.trim().length > 0}
                  onSend={handleSend}
                />
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </AnimatePresence>
    </ProtectedLayout>
  );
}
