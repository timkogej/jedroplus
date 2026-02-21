'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MagicWand, CircleNotch } from '@phosphor-icons/react';
import { callN8nAction } from '@/src/lib/n8nClient';

interface AIMessageGeneratorProps {
  onGenerate: (message: string) => void;
  companyId?: string;
  actor?: string;
  companyPayload?: Record<string, unknown>;
}

export default function AIMessageGenerator({ onGenerate, companyId, actor, companyPayload }: AIMessageGeneratorProps) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);

    try {
      const result = await callN8nAction({
        event: 'GENERIRAJ_SPOROCILO',
        entity: 'communication',
        data: {
          prompt: prompt.trim(),
          company_id: companyId || '',
          company_profile: companyPayload || {},
        },
        company_id: companyId || '',
        actor: actor || 'unknown',
        timestamp: new Date().toISOString(),
        meta: { app: 'Integrate' as const, version: '1.0' as const },
      });

      if (result.ok && result.data) {
        const responseData = result.data as Record<string, unknown>;
        const generatedMessage = (responseData.message || responseData.sporocilo || responseData.text || JSON.stringify(result.data)) as string;
        onGenerate(generatedMessage);
      } else {
        console.error('AI generation failed:', result.error);
      }
    } catch (err) {
      console.error('AI generation error:', err);
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
          <p className="text-xs text-gray-500">Opiši, kaj želiš sporočiti strankam</p>
        </div>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Npr: Sporoči strankam, da imamo 20% popust na vse storitve ta vikend. Ton naj bo prijazen in profesionalen."
        className="w-full h-24 px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-[#1A1F36] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 resize-none"
      />

      <motion.button
        type="button"
        onClick={handleGenerate}
        disabled={!prompt.trim() || isGenerating}
        whileHover={{ scale: prompt.trim() && !isGenerating ? 1.01 : 1 }}
        whileTap={{ scale: prompt.trim() && !isGenerating ? 0.99 : 1 }}
        className={`mt-3 w-full py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-all duration-200 ${
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
                Generiram...
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
              <span>Generiraj sporočilo</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
