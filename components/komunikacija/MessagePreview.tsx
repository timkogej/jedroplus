'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, CaretDown } from '@phosphor-icons/react';

interface MessagePreviewProps {
  subject: string;
  message: string;
  senderName: string;
}

export default function MessagePreview({ subject, message, senderName }: MessagePreviewProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Replace variables with mock data for preview
  const previewMessage = message
    .replace(/\{ime\}/g, 'Janez')
    .replace(/\{priimek\}/g, 'Novak')
    .replace(/\{email\}/g, 'janez.novak@email.com')
    .replace(/\{naslednji_termin\}/g, '15. feb 2025, 14:00')
    .replace(/\{podjetje\}/g, senderName);

  const previewSubject = subject
    .replace(/\{ime\}/g, 'Janez')
    .replace(/\{priimek\}/g, 'Novak')
    .replace(/\{podjetje\}/g, senderName);

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full p-4 bg-white hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Eye className="w-5 h-5 text-[#1A1F36]" weight="regular" />
          <span className="text-sm font-medium text-[#1A1F36]">Predogled sporočila</span>
        </div>
        <CaretDown
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          weight="bold"
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-gray-100">
              {/* Email preview card */}
              <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50/50 overflow-hidden">
                {/* Email header */}
                <div className="px-5 py-4 bg-white border-b border-gray-100">
                  <div className="flex items-center gap-3 mb-3">
                    <div>
                      <p
                        className="text-sm font-semibold"
                        style={{
                          backgroundImage: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                        }}
                      >
                        {senderName}
                      </p>
                      <p className="text-xs text-gray-400">info@podjetje.si</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Zadeva:</span>
                    <span className="text-sm font-medium text-[#1A1F36]">
                      {previewSubject || 'Brez zadeve'}
                    </span>
                  </div>
                </div>

                {/* Email body */}
                <div className="px-5 py-5 bg-white">
                  {previewMessage ? (
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {previewMessage}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400 italic">
                      Predogled bo prikazan, ko vnesete sporočilo...
                    </p>
                  )}
                </div>
              </div>

              <p className="mt-2 text-center text-xs text-gray-400">
                Spremenljivke so nadomeščene s podatki stranke
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
