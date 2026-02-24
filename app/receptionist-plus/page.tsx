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
  CaretRight,
  Warning,
  Sparkle,
  PencilSimple,
  ChartBar,
} from '@phosphor-icons/react';
import ProtectedLayout from '@/components/ProtectedLayout';
import { ReceptionistSettingsModal } from '@/components/receptionist/ReceptionistSettingsModal';

const GRADIENT = 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)';

const CAPABILITIES = [
  {
    title: 'Samodejno rezerviranje',
    description: 'Rezervira termine namesto vas',
    icon: Clock,
  },
  {
    title: 'Odgovarja na vprašanja',
    description: 'Uporabi bazo znanja za odgovore',
    icon: ChatText,
  },
  {
    title: 'Preusmeritev klicev',
    description: 'Ko je potrebna človeška pomoč',
    icon: ArrowsLeftRight,
  },
  {
    title: '24/7 dostopnost',
    description: 'Vedno na voljo za vaše stranke',
    icon: Phone,
  },
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
      {/* Mesh gradient background */}
      <div
        className="min-h-screen"
        style={{
          background:
            'radial-gradient(at 20% 20%, rgba(139, 92, 246, 0.08) 0px, transparent 50%), ' +
            'radial-gradient(at 80% 10%, rgba(6, 182, 212, 0.06) 0px, transparent 50%), ' +
            'radial-gradient(at 40% 80%, rgba(59, 130, 246, 0.05) 0px, transparent 50%), ' +
            'linear-gradient(180deg, #FAFBFF 0%, #F0F4FF 100%)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Page Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10 flex items-start justify-between"
          >
            <div>
              <h1
                className="text-3xl font-bold"
                style={{ background: GRADIENT, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
              >
                Receptionist+
              </h1>
              <p className="mt-1 text-base text-gray-500">Vaša AI telefonska asistentka</p>
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
          </motion.div>

          {/* Phone Number Hero Card */}
          {phoneNumber ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="relative overflow-hidden rounded-3xl mb-8"
              style={{
                background: GRADIENT,
                boxShadow: '0 20px 60px rgba(139, 92, 246, 0.3), 0 8px 24px rgba(0, 0, 0, 0.1)',
              }}
            >
              {/* Decorative blobs */}
              <div
                className="absolute top-0 right-0 w-64 h-64 rounded-full pointer-events-none"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  filter: 'blur(40px)',
                  transform: 'translate(30%, -50%)',
                }}
              />
              <div
                className="absolute bottom-0 left-0 w-48 h-48 rounded-full pointer-events-none"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  filter: 'blur(32px)',
                  transform: 'translate(-25%, 50%)',
                }}
              />

              <div className="relative p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                  <div className="flex items-center gap-5">
                    {/* Phone icon */}
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{
                        background: 'rgba(255,255,255,0.2)',
                        backdropFilter: 'blur(10px)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.15), inset 0 2px 0 rgba(255,255,255,0.2)',
                      }}
                    >
                      <Phone size={32} weight="regular" color="white" />
                    </div>

                    <div>
                      <p className="text-white/70 text-sm font-medium mb-1">Telefonska številka</p>
                      <h2 className="text-3xl font-bold text-white tracking-wide">{phoneNumber}</h2>

                      {/* Pulsing status */}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="relative flex h-3 w-3">
                          <motion.span
                            animate={{ scale: [1, 2, 1], opacity: [0.7, 0, 0.7] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="absolute inline-flex h-full w-full rounded-full"
                            style={{ background: '#34D399' }}
                          />
                          <span className="relative inline-flex rounded-full h-3 w-3" style={{ background: '#10B981' }} />
                        </span>
                        <span className="text-white/80 text-sm font-medium">Aktivna in pripravljena</span>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => copyToClipboard(phoneNumber)}
                      className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-medium text-white transition-colors"
                      style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)' }}
                    >
                      {copiedPhone ? <Check size={18} weight="bold" /> : <Copy size={18} weight="regular" />}
                      {copiedPhone ? 'Kopirano!' : 'Kopiraj'}
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => { window.location.href = `tel:${phoneNumber}`; }}
                      className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold transition-all"
                      style={{
                        background: 'white',
                        color: '#7C3AED',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                      }}
                    >
                      <PhoneCall size={18} weight="regular" />
                      Testiraj klic
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            /* Empty state – no phone number */
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="relative overflow-hidden rounded-3xl mb-8 border-2 border-dashed border-gray-200"
              style={{ background: 'linear-gradient(135deg, #F9FAFB 0%, #F3F4F6 100%)' }}
            >
              <div className="p-8 text-center">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: '#E5E7EB' }}
                >
                  <Phone size={32} weight="regular" className="text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">Telefonska številka ni na voljo</h3>
                <p className="text-gray-500 mb-6">Kontaktirajte podporo za aktivacijo vaše AI telefonske linije</p>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="px-6 py-3 rounded-xl text-white font-semibold"
                  style={{ background: GRADIENT, boxShadow: '0 4px 16px rgba(139,92,246,0.3)' }}
                >
                  Zahtevaj aktivacijo
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* Info Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">

            {/* Card 1: Knowledge base */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="group cursor-pointer"
              style={{
                background: 'rgba(255,255,255,0.8)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(139,92,246,0.08)',
                borderRadius: 20,
                padding: 24,
                boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(139,92,246,0.2)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 32px rgba(139,92,246,0.1)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(139,92,246,0.08)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.04)';
              }}
            >
              <div className="flex items-start justify-between mb-4">
                <span style={{ background: GRADIENT, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', display: 'inline-flex' }}>
                  <Books size={26} weight="regular" />
                </span>
                <CaretRight size={18} weight="bold" className="text-gray-300 group-hover:text-violet-400 transition-colors mt-1" />
              </div>

              <h3 className="font-semibold text-gray-800 text-base mb-2">Baza znanja</h3>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900">{knowledgeDocsCount}</span>
                <span className="text-gray-500 text-sm">dokumentov</span>
              </div>

              {knowledgeDocsCount === 0 && (
                <div className="flex items-center gap-1.5 mt-3">
                  <Warning size={14} weight="regular" className="text-amber-500 flex-shrink-0" />
                  <p className="text-xs text-amber-600">Dodajte dokumente za boljše odgovore</p>
                </div>
              )}
            </motion.div>

            {/* Card 2: Greeting */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="group cursor-pointer"
              style={{
                background: 'rgba(255,255,255,0.8)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(139,92,246,0.08)',
                borderRadius: 20,
                padding: 24,
                boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(139,92,246,0.2)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 32px rgba(139,92,246,0.1)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(139,92,246,0.08)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.04)';
              }}
            >
              <div className="flex items-start justify-between mb-4">
                <span style={{ background: GRADIENT, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', display: 'inline-flex' }}>
                  <ChatText size={26} weight="regular" />
                </span>
                <CaretRight size={18} weight="bold" className="text-gray-300 group-hover:text-violet-400 transition-colors mt-1" />
              </div>

              <h3 className="font-semibold text-gray-800 text-base mb-2">Pozdrav</h3>
              {greetingText ? (
                <p className="text-gray-600 text-sm line-clamp-2 leading-relaxed">{greetingText}</p>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                  <span className="text-gray-400 text-sm">Ni nastavljeno</span>
                </div>
              )}
            </motion.div>

            {/* Card 3: Forwarding */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="group cursor-pointer"
              style={{
                background: 'rgba(255,255,255,0.8)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(139,92,246,0.08)',
                borderRadius: 20,
                padding: 24,
                boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(139,92,246,0.2)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 32px rgba(139,92,246,0.1)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(139,92,246,0.08)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.04)';
              }}
            >
              <div className="flex items-start justify-between mb-4">
                <span style={{ background: GRADIENT, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', display: 'inline-flex' }}>
                  <ArrowsLeftRight size={26} weight="regular" />
                </span>
                <CaretRight size={18} weight="bold" className="text-gray-300 group-hover:text-violet-400 transition-colors mt-1" />
              </div>

              <h3 className="font-semibold text-gray-800 text-base mb-2">Preusmeritev</h3>
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: '#9CA3AF',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: 6,
                }}
              >
                Številka
              </p>
              {handoffNumber ? (
                <p className="font-mono text-sm font-semibold text-gray-800">{handoffNumber}</p>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" />
                  <span className="text-gray-400 text-sm">Ni nastavljeno</span>
                </div>
              )}
            </motion.div>
          </div>

          {/* Greeting Text Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-8"
            style={{
              background: 'rgba(255,255,255,0.8)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(139,92,246,0.08)',
              borderRadius: 20,
              padding: 24,
              boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
            }}
          >
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <span style={{ background: GRADIENT, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', display: 'inline-flex', flexShrink: 0 }}>
                  <ChatText size={24} weight="regular" />
                </span>
                <div>
                  <h3 className="font-semibold text-gray-800">Celotno pozdravno besedilo</h3>
                  <p className="text-sm text-gray-500 mt-0.5">Besedilo, ki ga AI prebere ob začetku klica</p>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowSettingsModal(true)}
                className="flex items-center gap-1.5 text-sm font-medium transition-colors"
                style={{ color: '#7C3AED' }}
              >
                <PencilSimple size={14} weight="regular" />
                Uredi
              </motion.button>
            </div>

            {greetingText ? (
              <div
                style={{
                  background: '#F9FAFB',
                  border: '1px solid #F3F4F6',
                  borderRadius: 14,
                  padding: '16px 20px',
                }}
              >
                <p className="text-gray-700 leading-relaxed italic">"{greetingText}"</p>
              </div>
            ) : (
              <div
                style={{
                  background: '#F9FAFB',
                  border: '2px dashed #E5E7EB',
                  borderRadius: 14,
                  padding: '28px 20px',
                  textAlign: 'center',
                }}
              >
                <p className="text-gray-400 mb-3 text-sm">Pozdravno besedilo še ni nastavljeno</p>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setShowSettingsModal(true)}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{ background: 'rgba(139,92,246,0.1)', color: '#7C3AED' }}
                >
                  + Dodaj besedilo
                </motion.button>
              </div>
            )}
          </motion.div>

          {/* Capabilities Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-8"
            style={{
              background: 'linear-gradient(135deg, rgba(139,92,246,0.04) 0%, rgba(6,182,212,0.04) 100%)',
              border: '1px solid rgba(139,92,246,0.1)',
              borderRadius: 20,
              padding: 24,
            }}
          >
            <div className="flex items-center gap-3 mb-6">
              <span style={{ background: GRADIENT, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', display: 'inline-flex' }}>
                <Sparkle size={24} weight="fill" />
              </span>
              <h3 className="font-semibold text-gray-800 text-lg">Zmožnosti</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {CAPABILITIES.map((capability, index) => (
                <motion.div
                  key={capability.title}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.08 }}
                  className="flex items-start gap-3 p-4 rounded-xl"
                  style={{
                    background: 'rgba(255,255,255,0.6)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.8)',
                  }}
                >
                  <span style={{ background: GRADIENT, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', display: 'inline-flex', flexShrink: 0, marginTop: 2 }}>
                    <CheckCircle size={18} weight="fill" />
                  </span>
                  <div>
                    <h4 className="font-medium text-gray-800 text-sm">{capability.title}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">{capability.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            style={{
              background: 'rgba(255,255,255,0.8)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(139,92,246,0.08)',
              borderRadius: 20,
              padding: 24,
              boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
            }}
          >
            <div className="flex items-center gap-3 mb-5">
              <span style={{ background: GRADIENT, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', display: 'inline-flex', flexShrink: 0 }}>
                <ChartBar size={24} weight="regular" />
              </span>
              <div>
                <h3 className="font-semibold text-gray-800">Hitre akcije</h3>
                <p className="text-sm text-gray-500">Upravljajte vašo AI recepcionistko</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowSettingsModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white"
                style={{ background: GRADIENT, boxShadow: '0 4px 16px rgba(139,92,246,0.3)' }}
              >
                <Gear size={16} weight="bold" />
                Uredi nastavitve
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => { if (phoneNumber) window.location.href = `tel:${phoneNumber}`; }}
                disabled={!phoneNumber}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'white',
                  border: '1px solid rgba(139,92,246,0.2)',
                  color: '#7C3AED',
                }}
              >
                <PhoneCall size={16} weight="regular" />
                Testiraj klic
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => copyToClipboard(phoneNumber)}
                disabled={!phoneNumber}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'white',
                  border: '1px solid rgba(139,92,246,0.2)',
                  color: '#7C3AED',
                }}
              >
                {copiedPhone ? <Check size={16} weight="bold" /> : <Copy size={16} weight="regular" />}
                {copiedPhone ? 'Kopirano!' : 'Kopiraj številko'}
              </motion.button>
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
