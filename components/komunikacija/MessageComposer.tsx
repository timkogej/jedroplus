'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, CaretDown, Sparkle } from '@phosphor-icons/react';

const staticVariables = [
  { key: '{{ime}}', label: 'Ime' },
  { key: '{{priimek}}', label: 'Priimek' },
  { key: '{{email}}', label: 'Email' },
  { key: '{{podjetje}}', label: 'Ime podjetja' },
  { key: '{{telefon_podjetja}}', label: 'Telefon podjetja' },
  { key: '{{email_podjetja}}', label: 'Email podjetja' },
  { key: '{{naslov_podjetja}}', label: 'Naslov podjetja' },
  { key: '{{zadnja_interakcija}}', label: 'Zadnja interakcija' },
  { key: '{{zadnja_storitev}}', label: 'Zadnja storitev' },
];

interface MessageComposerProps {
  subject: string;
  onSubjectChange: (value: string) => void;
  message: string;
  onMessageChange: (value: string) => void;
  availableVariables?: string[];
}

export default function MessageComposer({
  subject,
  onSubjectChange,
  message,
  onMessageChange,
  availableVariables,
}: MessageComposerProps) {
  const [showVariables, setShowVariables] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertVariable = (variable: string) => {
    if (!textareaRef.current) return;

    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const newMessage = message.substring(0, start) + variable + message.substring(end);
    onMessageChange(newMessage);
    setShowVariables(false);

    // Restore focus and cursor position
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newPos = start + variable.length;
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  const charCount = message.length;
  const hasAiVariables = availableVariables && availableVariables.length > 0;

  return (
    <div className="space-y-4">
      {/* Subject line */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-1.5 block">
          Zadeva
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          placeholder="Vnesite zadevo sporočila..."
          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-[#1A1F36] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all"
        />
      </div>

      {/* Message body */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-medium text-gray-700">Sporočilo</label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowVariables(!showVariables)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-50 hover:bg-gray-100 hover:text-gray-700 rounded-lg border border-gray-200 transition-all"
            >
              <Plus className="h-3 w-3" weight="bold" />
              Dodaj spremenljivko
              <CaretDown
                className={`h-2.5 w-2.5 transition-transform ${showVariables ? 'rotate-180' : ''}`}
                weight="bold"
              />
            </button>

            <AnimatePresence>
              {showVariables && (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-1.5 w-64 rounded-xl bg-white border border-gray-200 shadow-lg overflow-hidden z-20"
                >
                  {staticVariables.map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => insertVariable(v.key)}
                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors flex items-center justify-between"
                    >
                      <span className="text-gray-700">{v.label}</span>
                      <span className="text-xs text-gray-400 font-mono">{v.key}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => onMessageChange(e.target.value)}
          placeholder="Vaše sporočilo strankam..."
          className="w-full h-56 px-4 py-4 rounded-xl border border-gray-200 bg-white text-sm text-[#1A1F36] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 resize-none leading-relaxed transition-all"
        />

        <div className="flex items-center justify-between text-xs text-gray-400 mt-1.5">
          <span>
            Spremenljivke: {'{{ime}}'}, {'{{priimek}}'}, {'{{email}}'}, {'{{podjetje}}'}
          </span>
          <span>{charCount} znakov</span>
        </div>
      </div>

      {/* AI-generated variable chips */}
      <AnimatePresence>
        {hasAiVariables && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkle className="h-3.5 w-3.5 text-violet-500" weight="fill" />
                <p className="text-xs font-medium text-violet-600">Spremenljivke iz AI – klikni za vstavljanje:</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {availableVariables!.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertVariable(v)}
                    className="px-2.5 py-1 rounded-lg bg-white border border-violet-200 text-xs font-mono text-violet-700 hover:bg-violet-100 hover:border-violet-300 transition-colors"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
