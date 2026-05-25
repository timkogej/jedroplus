'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MagicWand, CircleNotch } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';

interface AIMessageGeneratorProps {
  onGenerate: (subject: string, message: string, variables: string[]) => void;
  onError?: (error: string) => void;
  companyId?: string;
  actor?: string;
}

export default function AIMessageGenerator({
  onGenerate,
  onError,
  companyId,
  actor,
}: AIMessageGeneratorProps) {
  const t = useTranslations('communication');
  const [prompt, setPrompt] = useState('');
  const [tone, setTone] = useState('prijazen');
  const [isGenerating, setIsGenerating] = useState(false);

  const toneOptions = [
    { value: 'prijazen', label: t('ai.toneFriendly') },
    { value: 'profesionalen', label: t('ai.toneProfessional') },
  ];

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);

    try {
      const payload = {
        event: 'GENERIRAJ_SPOROCILO',
        entity: 'communication',
        company_id: companyId || '',
        user_id: actor || 'unknown',
        actor: actor || 'unknown',
        timestamp: new Date().toISOString(),
        data: {
          company_id: companyId || '',
          prompt: prompt.trim(),
          tone,
        },
      };

      const response = await fetch('/api/communication/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.ok !== false) {
        const subject = typeof result.subject === 'string' ? result.subject : '';
        const message = typeof result.message === 'string' ? result.message : '';
        const variables: string[] = Array.isArray(result.available_variables)
          ? result.available_variables.filter((v: unknown) => typeof v === 'string')
          : [];
        onGenerate(subject, message, variables);
      } else {
        onError?.(t('ai.generateError'));
      }
    } catch (err) {
      console.error('AI generation error:', err);
      onError?.(t('ai.generateError'));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/60 to-cyan-50/40 p-5">
      <div className="flex items-center gap-3 mb-4">
        <div>
          <h3
            className="font-bold"
            style={{
              backgroundImage: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Asistent+
          </h3>
          <p className="text-xs text-gray-500">{t('ai.subtitle')}</p>
        </div>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={t('ai.promptPlaceholder')}
        className="w-full h-24 px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-[#1A1F36] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 resize-none"
      />

      {/* Tone selector */}
      <div className="mt-3">
        <p className="text-xs text-gray-500 mb-2">{t('ai.toneLabel')}</p>
        <div className="flex gap-2">
          {toneOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setTone(option.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                tone === option.value
                  ? 'bg-white border border-violet-300 text-violet-600 shadow-sm'
                  : 'bg-white/60 border border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <motion.button
        type="button"
        onClick={handleGenerate}
        disabled={!prompt.trim() || isGenerating}
        whileHover={{ scale: prompt.trim() && !isGenerating ? 1.01 : 1 }}
        whileTap={{ scale: prompt.trim() && !isGenerating ? 0.99 : 1 }}
        className={`mt-3 w-full py-3 rounded-xl flex items-center justify-center gap-2 text-sm transition-all duration-200 ${
          prompt.trim() && !isGenerating
            ? 'bg-white border border-gray-200 shadow-sm hover:shadow-md'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
      >
        <AnimatePresence mode="wait">
          {isGenerating ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <CircleNotch className="h-5 w-5 animate-spin" weight="bold" style={{ fill: 'url(#btn-icon-grad)' }} />
              <span
                style={{
                  backgroundImage: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {t('ai.generatingButton')}
              </span>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
              style={prompt.trim() ? {
                backgroundImage: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              } : undefined}
            >
              <MagicWand className="h-5 w-5" weight="bold" style={prompt.trim() ? { fill: 'url(#btn-icon-grad)' } : undefined} />
              <span>{t('ai.generateButton')}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
