'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Info,
  Plus,
  X,
} from '@phosphor-icons/react';
import { AssistantChat } from '@/components/asistent/AssistantChat';
import { InfoModal } from '@/components/asistent/InfoModal';
import { useCompany } from '@/app/company-context';
import ProtectedLayout from '@/components/ProtectedLayout';

// Generate unique IDs
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

    const newSessionId = generateId();
    setCurrentSessionId(newSessionId);
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
          <div className="text-center">
            <p className="text-gray-600">Prosimo, izberite podjetje</p>
          </div>
        </div>
      </ProtectedLayout>
    );
  }

  if (loading) {
    return (
      <ProtectedLayout>
        <div className="h-[calc(100vh-4rem)] flex items-center justify-center bg-white">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-black border-t-transparent" />
        </div>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <div className="h-[calc(100vh-4rem)] flex flex-col bg-gradient-to-br from-slate-50 via-white to-violet-50/30">
        <div className="flex-1 flex flex-col p-6 max-w-[820px] mx-auto w-full">
          {/* HEADER - Gradient title, smaller beta badge, + button only */}
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            {/* Title with gradient - no icon */}
            <div className="flex items-center gap-2">
              <h1
                className="text-xl font-bold"
                style={{
                  background: 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Asistent+
              </h1>
              {/* Smaller, softer BETA badge */}
              <span className="px-1.5 py-0.5 text-[9px] font-medium bg-gray-100 text-gray-500 rounded border border-gray-200">
                BETA
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {/* New Session - just + icon button with tooltip */}
              <motion.button
                onClick={handleNewSession}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-9 h-9 flex items-center justify-center bg-gradient-to-r from-violet-500 to-cyan-500 rounded-xl text-white shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/30 transition-shadow"
                title="Nova seja"
              >
                <Plus className="w-5 h-5" weight="bold" />
              </motion.button>

              {/* Info Button */}
              <motion.button
                onClick={() => setShowInfo(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-9 h-9 flex items-center justify-center bg-white border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 hover:text-violet-500 transition-colors shadow-sm"
              >
                <Info className="w-5 h-5" weight="regular" />
              </motion.button>
            </div>
          </div>

          {/* CHAT INTERFACE */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden min-h-0 h-[600px] max-h-[calc(100vh-12rem)] w-full"
          >
            {currentSessionId && (
              <AssistantChat sessionId={currentSessionId} key={currentSessionId} />
            )}
          </motion.div>
        </div>

        {/* INFO MODAL */}
        <AnimatePresence>
          {showInfo && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
              onClick={() => setShowInfo(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
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
      </div>
    </ProtectedLayout>
  );
}
