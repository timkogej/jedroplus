'use client';

interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function TimePicker({ value, onChange, disabled = false }: TimePickerProps) {
  return (
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`
        px-3 py-2 text-sm border border-gray-200 rounded-lg
        focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900
        transition-colors duration-200
        ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'cursor-pointer'}
      `}
    />
  );
}
