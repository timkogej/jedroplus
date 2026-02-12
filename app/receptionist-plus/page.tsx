'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import {
  Copy,
  Check,
  Phone,
  PhoneCall,
  Gear,
  ChatText,
  Books,
  ArrowsLeftRight,
  CheckCircle,
  Clock,
} from '@phosphor-icons/react';
import ProtectedLayout from '@/components/ProtectedLayout';
import { ReceptionistSettingsModal } from '@/components/receptionist/ReceptionistSettingsModal';

const CAPABILITIES = [
  { title: 'Samodejno rezerviranje', description: 'Rezervira termine namesto vas', icon: Clock },
  { title: 'Odgovarja na vprašanja', description: 'Uporabi bazo znanja', icon: ChatText },
  { title: 'Preusmeritev klicev', description: 'Ko je potrebna človeška pomoč', icon: ArrowsLeftRight },
  { title: '24/7 dostopnost', description: 'Vedno na voljo', icon: Phone },
];

export default function ReceptionistPlusPage() {
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const phoneNumber = '';
  const greetingText = '';
  const handoffNumber = '';
  const knowledgeDocsCount = 0;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <ProtectedLayout>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                  <span className="bg-gradient-to-r from-violet-600 to-cyan-500 bg-clip-text text-transparent">
                    Receptionist+
                  </span>
                </h1>
                <p className="mt-1 text-gray-500">Vaša AI telefonska asistentka</p>
              </div>

              <motion.button
                onClick={() => setShowSettingsModal(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-10 h-10 flex items-center justify-center bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all"
                title="Nastavitve"
              >
                <Gear size={20} weight="bold" className="text-gray-900" />
              </motion.button>
            </div>
          </motion.div>

          {/* Phone Number Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
              <div className="flex items-center gap-2.5 mb-3">
                <Phone className="w-4 h-4 text-gray-900" weight="regular" />
                <span className="text-xs font-medium text-gray-500">Telefonska številka</span>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <div className="flex-1 py-2 px-3 bg-gray-50 rounded-lg border border-gray-200 text-center sm:text-left">
                  {phoneNumber ? (
                    <span
                      className="font-mono text-base sm:text-lg font-bold"
                      style={{
                        background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                      }}
                    >
                      {phoneNumber}
                    </span>
                  ) : (
                    <span className="text-base font-semibold text-gray-400">
                      Številka ni na voljo
                    </span>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => copyToClipboard(phoneNumber)}
                    disabled={!phoneNumber}
                    className="flex-1 sm:flex-none h-9 w-full sm:w-9 flex items-center justify-center gap-1.5 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {copiedPhone ? (
                      <Check className="w-4 h-4 text-green-500" weight="bold" />
                    ) : (
                      <span
                        style={{
                          background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                        }}
                      >
                        <Copy className="w-4 h-4" />
                      </span>
                    )}
                    <span className="sm:hidden text-xs">{copiedPhone ? 'Kopirano!' : 'Kopiraj'}</span>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => window.location.href = `tel:${phoneNumber}`}
                    disabled={!phoneNumber}
                    className="flex-1 sm:flex-none h-9 w-full sm:w-9 flex items-center justify-center gap-1.5 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span
                      style={{
                        background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                      }}
                    >
                      <PhoneCall className="w-4 h-4" />
                    </span>
                    <span className="sm:hidden text-xs">Pokliči</span>
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Configuration Cards Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
          >
            {/* Knowledge Base Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <Books className="w-5 h-5 text-gray-900" weight="regular" />
                <h3 className="font-bold text-lg text-gray-900">Baza znanja</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-3xl font-bold text-gray-900">
                    {knowledgeDocsCount}
                  </div>
                  <div className="text-sm text-gray-600">dokumentov</div>
                </div>
              </div>
            </div>

            {/* Greeting Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <ChatText className="w-5 h-5 text-gray-900" weight="regular" />
                <h3 className="font-bold text-lg text-gray-900">Pozdrav</h3>
              </div>
              <div className="text-sm text-gray-700 line-clamp-3">
                {greetingText || 'Ni nastavljeno'}
              </div>
            </div>

            {/* Handoff Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <PhoneCall className="w-5 h-5 text-gray-900" weight="regular" />
                <h3 className="font-bold text-lg text-gray-900">Preusmeritev</h3>
              </div>
              <div className="space-y-2">
                <div className="text-xs text-gray-500 uppercase tracking-wider">Številka</div>
                <div className="font-mono text-sm font-semibold text-gray-900">
                  {handoffNumber || '-'}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Greeting Text Full */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-8"
          >
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <ChatText className="w-5 h-5 text-gray-900" weight="regular" />
                <h3 className="font-bold text-lg text-gray-900">Celotno pozdravno besedilo</h3>
              </div>
              <p className="text-gray-700 whitespace-pre-wrap">
                {greetingText || 'Ni nastavljeno'}
              </p>
            </div>
          </motion.div>

          {/* Capabilities */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-gradient-to-br from-violet-50 to-cyan-50 rounded-2xl border-2 border-violet-100 p-6 mb-8"
          >
            <h3 className="font-bold text-lg text-gray-900 mb-4">Zmožnosti</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {CAPABILITIES.map((capability, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" weight="regular" />
                  <div>
                    <div className="font-semibold text-gray-900">{capability.title}</div>
                    <div className="text-sm text-gray-600">{capability.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
          >
            <h3 className="font-bold text-lg text-gray-900 mb-4">Hitre akcije</h3>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowSettingsModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                <Gear size={18} className="text-gray-900" />
                Uredi nastavitve
              </button>
              <button
                onClick={() => window.location.href = `tel:${phoneNumber}`}
                disabled={!phoneNumber}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PhoneCall size={18} className="text-gray-900" />
                Testiraj klic
              </button>
              <button
                onClick={() => copyToClipboard(phoneNumber)}
                disabled={!phoneNumber}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Copy size={18} className="text-gray-900" />
                Kopiraj številko
              </button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Settings Modal */}
      <ReceptionistSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </ProtectedLayout>
  );
}
