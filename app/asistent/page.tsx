'use client';

// ── Začasno skrito – stran bo dodana nazaj ──────────────────────────────────
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AsistentPlusPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard'); }, [router]);
  return null;
}

// ── Originalna koda (ohranjena za pozneje) ────────────────────────────────────
/*
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from '@phosphor-icons/react';
import { PageSpinner } from '@/components/ui/GradientSpinner';
import { AssistantChat } from '@/components/asistent/AssistantChat';
import { InfoModal } from '@/components/asistent/InfoModal';
import { useCompany } from '@/app/company-context';
import ProtectedLayout from '@/components/ProtectedLayout';

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
    return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

const HISTORY_DISABLED = true;

export default function AsistentPlusPage() {
  const { companyId } = useCompany();
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [loading, setLoading] = useState(true);

  const handleNewSession = useCallback(() => {
    if (!companyId) return;
    setCurrentSessionId(generateId());
  }, [companyId]);

  const initializeSession = useCallback(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    if (HISTORY_DISABLED) {
      handleNewSession();
      setLoading(false);
      return;
    }

    setLoading(false);
  }, [companyId, handleNewSession]);

  useEffect(() => {
    initializeSession();
  }, [initializeSession]);

  if (!companyId) {
    return (
      <ProtectedLayout>
        <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
          <p className="text-gray-600">Prosimo, izberite podjetje</p>
        </div>
      </ProtectedLayout>
    );
  }

  if (loading) {
    return (
      <ProtectedLayout>
        <PageSpinner />
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <div
        className="h-[calc(100vh-4rem)] flex overflow-hidden"
        style={{
          background:
            'radial-gradient(at 40% 20%, rgba(139, 92, 246, 0.08) 0px, transparent 50%), ' +
            'radial-gradient(at 80% 0%, rgba(6, 182, 212, 0.06) 0px, transparent 50%), ' +
            'radial-gradient(at 0% 50%, rgba(59, 130, 246, 0.06) 0px, transparent 50%), ' +
            '#F8FAFF',
        }}
      >
        {currentSessionId && (
          <AssistantChat
            sessionId={currentSessionId}
            key={currentSessionId}
            onNewSession={handleNewSession}
            onShowInfo={() => setShowInfo(true)}
          />
        )}
      </div>

      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)' }}
            onClick={() => setShowInfo(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="relative w-full max-w-md max-h-[600px] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowInfo(false)}
                className="absolute right-3 top-3 p-1.5 rounded-full hover:bg-gray-100 transition-colors z-10"
              >
                <X className="w-4 h-4 text-gray-500" weight="bold" />
              </button>
              <div className="overflow-y-auto flex-1">
                <InfoModal onClose={() => setShowInfo(false)} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ProtectedLayout>
  );
}
*/
