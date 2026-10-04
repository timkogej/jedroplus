'use client';

import { switchTrack, switchKnob } from '@/components/ui/switchClasses';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  variant?: 'default' | 'brand';
}

/**
 * Stikalo v iOS merah na telefonu (tir 51×31) in macOS merah na računalniku
 * (tir 36×20) — glej components/ui/switchClasses.
 * Barvi ostaneta taki, kot sta bili — spremenjena je samo geometrija.
 */
export function Switch({ checked, onChange, disabled = false, variant = 'default' }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`
        ${switchTrack} ease-out
        focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#7C78FA]/45 focus-visible:ring-offset-1
        ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
        ${checked
          ? variant === 'brand' ? 'bg-[#6D5EF7]' : 'bg-[#0a0a0a]'
          : 'bg-gray-200 hover:bg-gray-300'
        }
      `}
    >
      <span className={switchKnob(checked)} />
    </button>
  );
}
