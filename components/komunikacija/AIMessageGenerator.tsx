'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkle, MagicWand, CircleNotch } from '@phosphor-icons/react';

interface AIMessageGeneratorProps {
  onGenerate: (message: string) => void;
}

export default function AIMessageGenerator({ onGenerate }: AIMessageGeneratorProps) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);

    // Simulate AI generation
    setTimeout(() => {
      const generatedMessage = `Spoštovani {ime},\n\nZ veseljem vas obveščamo o posebni ponudbi, ki smo jo pripravili samo za vas!\n\n${prompt.includes('popust') ? 'Ta vikend vam ponujamo 20% popust na vse naše storitve. To je odlična priložnost, da poskrbite zase in uživate v naših premium storitvah po ugodni ceni.' : 'Pripravljamo nekaj posebnega in želimo, da ste med prvimi, ki bodo izvedeli za to.'}\n\nZa rezervacijo termina nas pokličite ali odgovorite na to sporočilo.\n\nVeselimo se vašega obiska!\n\nLep pozdrav,\nVaša ekipa`;

      onGenerate(generatedMessage);
      setIsGenerating(false);
    }, 2000);
  };

  return (
    <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/60 to-cyan-50/40 p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 shadow-md shadow-violet-500/20">
          <Sparkle className="h-5 w-5 text-white" weight="fill" />
        </div>
        <div>
          <h3 className="font-semibold text-[#1A1F36]">AI Asistent</h3>
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
            ? 'bg-gradient-to-r from-violet-500 to-cyan-500 text-white shadow-lg shadow-violet-500/20 hover:shadow-xl hover:shadow-violet-500/30'
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
              <CircleNotch className="h-5 w-5 animate-spin" weight="bold" />
              <span>Generiram...</span>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <MagicWand className="h-5 w-5" weight="bold" />
              <span>Generiraj sporočilo</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
