'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, CaretDown } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';

interface MessagePreviewProps {
  subject: string;
  message: string;
  senderName: string;
  /** V dvostolpčni postavitvi je predogled smiselno pustiti odprt. */
  defaultOpen?: boolean;
}

export default function MessagePreview({ subject, message, senderName, defaultOpen = false }: MessagePreviewProps) {
  const t = useTranslations('communication');
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Replace variables with mock data for preview
  const applyVariables = (text: string) =>
    text
      .replace(/\{\{ime\}\}/g, 'Janez')
      .replace(/\{\{priimek\}\}/g, 'Novak')
      .replace(/\{\{email\}\}/g, 'janez.novak@email.com')
      .replace(/\{\{podjetje\}\}/g, senderName)
      .replace(/\{\{telefon_podjetja\}\}/g, '+386 1 234 5678')
      .replace(/\{\{email_podjetja\}\}/g, 'info@podjetje.si')
      .replace(/\{\{naslov_podjetja\}\}/g, 'Slovenska cesta 1, Ljubljana')
      .replace(/\{\{zadnja_interakcija\}\}/g, '10. feb 2025')
      .replace(/\{\{zadnja_storitev\}\}/g, 'Striženje las');

  const previewMessage = applyVariables(message);
  const previewSubject = applyVariables(subject);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-4 transition-colors hover:bg-gray-50"
      >
        <div className="flex items-center gap-3">
          <Eye className="h-5 w-5 text-gray-400" weight="regular" />
          <span className="text-sm font-medium text-gray-900">{t('preview.toggleButton')}</span>
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
              <div className="mt-4 overflow-hidden rounded-xl border border-gray-100">
                {/* Email header */}
                <div className="px-5 py-4 bg-white border-b border-gray-100">
                  <div className="flex items-center gap-3 mb-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{senderName}</p>
                      <p className="text-xs text-gray-400">info@podjetje.si</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{t('preview.subjectLabel')}</span>
                    <span className="text-sm font-medium text-gray-900">
                      {previewSubject || t('preview.noSubject')}
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
                      {t('preview.empty')}
                    </p>
                  )}
                </div>
              </div>

              <p className="mt-2 text-center text-xs text-gray-400">
                {t('preview.note')}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
