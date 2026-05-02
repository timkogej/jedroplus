'use client';

import { motion, AnimatePresence } from 'motion/react';
import { X, Bell, Globe, ChatCircleText, Robot, ChartLineUp } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';

export const TRIAL_MODAL_SESSION_KEY = 'jedroplus_trial_modal_shown';

function markShownToday() {
  localStorage.setItem(TRIAL_MODAL_SESSION_KEY, new Date().toDateString());
}

export function wasShownToday(): boolean {
  return localStorage.getItem(TRIAL_MODAL_SESSION_KEY) === new Date().toDateString();
}

const FEATURES = [
  {
    icon: Bell,
    title: 'Personalizirani opomniki',
    desc: 'Avtomatski opomniki strankam pred in po vsakem terminu — brez ročnega dela.',
  },
  {
    icon: Globe,
    title: 'Spletno naročanje + različni dizajni',
    desc: 'Booking link z izborom dizajna strani — stranke se naročajo same, kadarkoli.',
  },
  {
    icon: ChatCircleText,
    title: 'Komunikacija s strankami',
    desc: 'Funkcija, ki poenostavi vso komunikacijo — SMS, email in opomniki na enem mestu.',
  },
  {
    icon: Robot,
    title: 'Asistent+',
    desc: 'AI asistent za upravljanje terminov, strank in odgovarjanje na poizvedbe.',
  },
  {
    icon: ChartLineUp,
    title: 'Celotna analitika',
    desc: 'Pregled prihodkov, zasedenosti, rasti strank in uspešnosti poslovanja.',
  },
];

interface FreeTrialModalProps {
  show: boolean;
  onDismiss: () => void;
}

export default function FreeTrialModal({ show, onDismiss }: FreeTrialModalProps) {
  const router = useRouter();

  const handleDismiss = () => {
    markShownToday();
    onDismiss();
  };

  const handleTry = () => {
    markShownToday();
    onDismiss();
    router.push('/billing');
  };

  return (
    <AnimatePresence>
      {show && (
        <>
          {/* Hidden SVG gradient definition — used by all icons below */}
          <svg width="0" height="0" style={{ position: 'absolute', overflow: 'hidden' }}>
            <defs>
              <linearGradient id="trial-icon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8B5CF6" />
                <stop offset="100%" stopColor="#06B6D4" />
              </linearGradient>
            </defs>
          </svg>

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
              className="pointer-events-auto w-full max-w-md max-h-[90vh] rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Gradient header */}
              <div
                className="relative px-6 pt-7 pb-5 flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 60%, #06B6D4 100%)' }}
              >
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="absolute top-4 right-4 rounded-full p-1.5 bg-white/20 hover:bg-white/30 text-white transition-colors"
                >
                  <X className="h-4 w-4" weight="bold" />
                </button>
                <span className="inline-block bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full mb-2.5">
                  🎁 Brezplačna preizkušnja
                </span>
                <h2 className="text-xl font-bold text-white leading-tight">
                  Izkoristite brezplačno<br />preizkušnjo Jedro Plus!
                </h2>
                <p className="text-white/80 text-sm mt-1.5">
                  Vse kar potrebujete za urejeno poslovanje — brez tveganja, brez obveznosti.
                </p>
              </div>

              {/* Features — scrollable */}
              <div className="px-6 py-4 space-y-3 overflow-y-auto flex-1">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
                  Kaj dobite z Jedro Plus
                </p>
                {FEATURES.map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-50 ring-1 ring-gray-100">
                      <Icon
                        className="h-[18px] w-[18px]"
                        weight="regular"
                        style={{ stroke: 'url(#trial-icon-grad)', fill: 'none', color: 'transparent' }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 leading-snug">{title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="px-6 pb-5 pt-1 flex flex-col gap-2 flex-shrink-0">
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
                  className="w-full rounded-xl py-2.5 text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors"
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
