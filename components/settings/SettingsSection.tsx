'use client';

import { motion } from 'motion/react';

interface SettingsSectionProps {
  title: string;
  description?: string;
  /** Drobna razlaga POD skupino — Apple jo postavi izven kartice, ne vanjo. */
  footnote?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Skupina nastavitev v Applovem slogu.
 *
 * Naslov stoji NAD kartico, ne v njej — tako kot v iOS in macOS Nastavitvah.
 * Vrstice v kartici loči lasna črta; padding dobijo neposredni otroci prek
 * `[&>*]`, da vzorec deluje tudi tam, kjer stran namesto `SettingRow` poda
 * svoj `div` ali polje.
 */
export function SettingsSection({ title, description, footnote, children }: SettingsSectionProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
      className="mb-7"
    >
      <h2 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-[0.04em] text-gray-400">
        {title}
      </h2>
      {description && (
        <p className="mb-2 px-1 text-sm text-gray-500">{description}</p>
      )}
      <div className="rounded-xl border border-gray-100 bg-white px-4">
        <div className="divide-y divide-gray-100 [&>*]:py-4 [&>*:first-child]:pt-4 [&>*:last-child]:pb-4">
          {children}
        </div>
      </div>
      {footnote && (
        <p className="mt-1.5 px-1 text-sm text-gray-400">{footnote}</p>
      )}
    </motion.section>
  );
}
