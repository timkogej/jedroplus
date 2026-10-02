'use client';

interface SettingRowProps {
  label: React.ReactNode;
  description?: string;
  children: React.ReactNode;
  error?: string;
  fullWidth?: boolean;
}

/**
 * Vrstica nastavitve: oznaka levo, kontrola desno — vzorec iz macOS Nastavitev.
 *
 * Široke kontrole (polja, spustni seznami) se na telefonu prelomijo pod
 * oznako, ker drugače ni prostora. Stikalo pa mora ostati ob oznaki tudi na
 * telefonu — tako je v iOS Nastavitvah in drugače vrstica razpade.
 * Namesto dodatne zastavice, ki bi jo bilo treba podajati na vsakem mestu
 * posebej, to ugotovimo iz vsebine: `has-[button[role=switch]]` prime vrstico,
 * v kateri je stikalo, in jo pusti v eni vrsti.
 *
 * Pri `fullWidth` gre kontrola pod oznako ne glede na širino (dolga besedila).
 */
export function SettingRow({ label, description, children, error, fullWidth = false }: SettingRowProps) {
  return (
    <div
      className={
        fullWidth
          ? 'flex flex-col gap-2.5'
          : 'flex flex-col gap-2.5 has-[button[role=switch]]:flex-row has-[button[role=switch]]:items-center has-[button[role=switch]]:justify-between has-[button[role=switch]]:gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6'
      }
    >
      <div className={fullWidth ? '' : 'min-w-0 flex-1'}>
        <label className="block text-sm font-medium text-gray-900">{label}</label>
        {description && <p className="mt-0.5 text-sm text-gray-500">{description}</p>}
      </div>
      <div
        className={
          fullWidth
            ? 'w-full'
            : 'w-full flex-shrink-0 has-[button[role=switch]]:w-auto sm:flex sm:w-64 sm:justify-end'
        }
      >
        {children}
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
