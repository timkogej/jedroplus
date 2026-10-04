'use client';

interface MiniSwitchProps {
  checked: boolean;
  onChange: () => void;
  label?: string;
}

/**
 * Majhno stikalo za vrstice v tabelah — mere macOS (36×20), ne iOS.
 *
 * Isto stikalo je bilo doslej v vsaki tabeli promocij napisano znova. Barve
 * so ostale kot prej: vklopljeno temno, izklopljeno sivo.
 */
export function MiniSwitch({ checked, onChange, label }: MiniSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${
        checked ? 'bg-gray-900' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-[18px]' : 'translate-x-[2px]'
        }`}
      />
    </button>
  );
}

export default MiniSwitch;
