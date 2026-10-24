'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';

/** Glavni gumb — edino mesto z gradientom (Apple slog Jedro+). */
export function PrimaryButton({ className = '', children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-5 text-[15px] font-semibold text-white shadow-sm transition-opacity hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ className = '', children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

export interface GuideStep {
  icon: PhosphorIcon;
  text: ReactNode;
  hint?: ReactNode;
}

/**
 * Oštevilčeni koraki z ikono gumba, ki ga je treba tapniti — tako, kot je
 * gumb narisan v Safariju ali Chromu, da ga uporabnik prepozna.
 */
export function GuideSteps({ steps }: { steps: GuideStep[] }) {
  return (
    <ol className="overflow-hidden rounded-xl border border-gray-100">
      {steps.map((step, i) => {
        const Icon = step.icon;
        return (
          <li key={i} className={`flex items-center gap-3.5 bg-white px-4 py-3 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
            <span className="tnum w-4 flex-shrink-0 text-center text-[13px] font-semibold text-gray-400" aria-hidden="true">
              {i + 1}
            </span>
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] border border-gray-200 bg-gray-50 text-[#007AFF]" aria-hidden="true">
              <Icon size={20} weight="regular" />
            </span>
            <span className="min-w-0 flex-1 text-[15px] leading-snug text-gray-700">
              {step.text}
              {step.hint && <span className="mt-0.5 block text-[13px] text-gray-400">{step.hint}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function Bold({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-gray-900">{children}</strong>;
}

export function Notice({ tone = 'neutral', children }: { tone?: 'neutral' | 'warning' | 'success'; children: ReactNode }) {
  const tones = {
    neutral: 'bg-gray-50 text-gray-600',
    warning: 'bg-amber-50 text-amber-800',
    success: 'bg-emerald-50 text-emerald-800',
  };
  return <p className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${tones[tone]}`}>{children}</p>;
}
