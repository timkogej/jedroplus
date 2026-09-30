'use client';

import { useState } from 'react';
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
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <div className="mb-3 flex items-center gap-3">
        <div>
          {/* Asistent+ je ime izdelka, zato obdrži gradient znamke. */}
          <h3
            className="text-[15px] font-semibold"
            style={{
              backgroundImage: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Asistent+
          </h3>
          <p className="mt-0.5 text-[13px] text-gray-500">{t('ai.subtitle')}</p>
        </div>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={t('ai.promptPlaceholder')}
        className="h-24 w-full resize-none rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition-colors focus:border-[#7C78FA] focus:outline-none focus:ring-[3px] focus:ring-[#7C78FA]/25"
      />

      {/* Tone selector */}
      <div className="mt-3">
        <p className="mb-2 text-[13px] text-gray-500">{t('ai.toneLabel')}</p>
        <div className="flex gap-2">
          {toneOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setTone(option.value)}
              className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
                tone === option.value
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={!prompt.trim() || isGenerating}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:bg-none disabled:bg-gray-100 disabled:text-gray-400 disabled:shadow-none"
      >
        {isGenerating ? (
          <>
            <CircleNotch className="h-4 w-4 animate-spin" weight="bold" />
            {t('ai.generatingButton')}
          </>
        ) : (
          <>
            <MagicWand className="h-4 w-4" weight="bold" />
            {t('ai.generateButton')}
          </>
        )}
      </button>
    </div>
  );
}
