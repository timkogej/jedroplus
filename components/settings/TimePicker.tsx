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
        native-date-time-input tnum rounded-lg border border-gray-200 bg-white px-3 py-2
        text-base text-gray-900 transition-colors duration-150
        focus:border-[#7C78FA] focus:outline-none focus:ring-[3px] focus:ring-[#7C78FA]/25
        ${disabled ? 'cursor-not-allowed bg-gray-50 opacity-50' : 'cursor-pointer'}
      `}
    />
  );
}
