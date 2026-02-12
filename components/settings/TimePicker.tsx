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
        focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-20 focus:border-purple-500
        transition-colors duration-200
        ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'cursor-pointer'}
      `}
    />
  );
}
