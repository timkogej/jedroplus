'use client';

import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CaretDown, type Icon } from '@phosphor-icons/react';

interface AddonRowProps {
  id?: string;
  icon: Icon;
  title: string;
  /** One line under the title (what is included, what is active). */
  subtitle?: ReactNode;
  /** Right side of the closed row: a meter, a status chip, ... */
  aside?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/**
 * One add-on as a wide, low row. Closed it is a single line with the state at
 * a glance; open it unfolds the controls underneath. Rows stack inside an
 * <AddonGroup>, separated by hairlines.
 */
export function AddonRow({ id, icon: IconComp, title, subtitle, aside, open, onToggle, children }: AddonRowProps) {
  return (
    <div id={id} className="scroll-mt-6">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-gray-50/70 sm:px-5"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-gray-50 text-gray-600">
          <IconComp size={18} weight="regular" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold tracking-tight text-gray-900">{title}</span>
          {subtitle && <span className="mt-0.5 block text-[13px] leading-5 text-gray-500">{subtitle}</span>}
        </span>
        {aside && <span className="hidden shrink-0 sm:block">{aside}</span>}
        <CaretDown
          size={16}
          weight="bold"
          aria-hidden="true"
          className={`shrink-0 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-gray-100 bg-gray-50/40 px-4 py-4 sm:px-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Rounded container that holds a stack of rows. */
export function AddonGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section aria-label={label}>
      <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</h2>
      <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
        {children}
      </div>
    </section>
  );
}

/** Slim usage meter with a "used / total" label, for the closed row. */
export function UsageMeter({ used, total, label }: { used: number; total: number; label: string }) {
  const percent = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const tone = percent > 90 ? 'bg-red-500' : percent > 70 ? 'bg-amber-400' : 'bg-gray-900';
  return (
    <span className="flex w-36 flex-col items-end gap-1.5">
      <span className="tnum text-xs font-medium text-gray-600">{label}</span>
      <span className="h-1 w-full overflow-hidden rounded-full bg-gray-100">
        <span className={`block h-full rounded-full transition-all duration-500 ${tone}`} style={{ width: `${percent}%` }} />
      </span>
    </span>
  );
}

/** Small status pill, e.g. "+100 SMS aktivno". */
export function StatusChip({ children, tone = 'violet' }: { children: ReactNode; tone?: 'violet' | 'amber' | 'green' | 'gray' }) {
  const tones = {
    violet: 'bg-[#6D5EF7]/10 text-[#6D5EF7]',
    amber: 'bg-amber-50 text-amber-700',
    green: 'bg-emerald-50 text-emerald-700',
    gray: 'bg-gray-100 text-gray-600',
  } as const;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}
