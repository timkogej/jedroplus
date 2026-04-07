'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle, CalendarBlank, Bell, ChartBar, Users, Link } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';

const SESSION_KEY = 'jedroplus_trial_modal_dismissed';

const FEATURES = [
  { icon: CalendarBlank, text: 'Baza terminov in strank' },
  { icon: Users, text: 'Baza storitev in osebja' },
  { icon: Bell, text: 'Personalizirani opomniki pred in po terminu' },
  { icon: ChartBar, text: 'Celotna analitika poslovanja' },
  { icon: Link, text: 'Booking link za spletne rezervacije' },
];

interface FreeTrialModalProps {
  show: boolean;
  onDismiss: () => void;
}

export default function FreeTrialModal({ show, onDismiss }: FreeTrialModalProps) {
  const router = useRouter();

  const handleDismiss = () => {
    sessionStorage.setItem(SESSION_KEY, '1');
    onDismiss();
  };

  const handleTry = () => {
    sessionStorage.setItem(SESSION_KEY, '1');
    onDismiss();
    router.push('/plans');
  };

  return (
    <AnimatePresence>
      {show && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
            onClick={handleDismiss}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 24 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="pointer-events-auto w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Gradient header */}
              <div
                className="relative px-6 pt-8 pb-6"
                style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 60%, #06B6D4 100%)' }}
              >
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="absolute top-4 right-4 rounded-full p-1.5 bg-white/20 hover:bg-white/30 text-white transition-colors"
                >
                  <X className="h-4 w-4" weight="bold" />
                </button>
                <div className="mb-3">
                  <span className="inline-block bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full mb-3">
                    🎁 Brezplačna preizkušnja
                  </span>
                  <h2 className="text-2xl font-bold text-white leading-tight">
                    Izkoristite brezplačno<br />preizkušnjo Jedro Plus!
                  </h2>
                  <p className="text-white/80 text-sm mt-2">
                    Odkrijte vse prednosti in dvignite svoje poslovanje na višjo raven — brez tveganja.
                  </p>
                </div>
              </div>

              {/* Features */}
              <div className="px-6 py-5 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Kaj dobite z Jedro Plus</p>
                {FEATURES.map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-3">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-violet-50">
                      <Icon className="h-4 w-4 text-violet-500" weight="duotone" />
                    </div>
                    <span className="text-sm text-gray-700">{text}</span>
                    <CheckCircle className="ml-auto h-4 w-4 flex-shrink-0 text-emerald-500" weight="fill" />
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="px-6 pb-6 flex flex-col gap-3">
                <motion.button
                  type="button"
                  onClick={handleTry}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full rounded-xl py-3 font-semibold text-white shadow-lg transition-all"
                  style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 60%, #06B6D4 100%)' }}
                >
                  Preizkusi brezplačno
                </motion.button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="w-full rounded-xl py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Mogoče kasneje
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export { SESSION_KEY as TRIAL_MODAL_SESSION_KEY };
