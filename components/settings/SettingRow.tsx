'use client';

interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
  error?: string;
  fullWidth?: boolean;
}

export function SettingRow({ label, description, children, error, fullWidth = false }: SettingRowProps) {
  return (
    <div className={`${fullWidth ? 'flex flex-col gap-3' : 'flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-8'}`}>
      <div className={fullWidth ? '' : 'flex-1'}>
        <label className="block text-sm font-medium text-gray-900">
          {label}
        </label>
        {description && (
          <p className="text-sm text-gray-500 mt-0.5">{description}</p>
        )}
      </div>
      <div className={fullWidth ? 'w-full' : 'w-full sm:w-72 flex-shrink-0'}>
        {children}
        {error && (
          <p className="text-xs text-red-600 mt-1">{error}</p>
        )}
      </div>
    </div>
  );
}
