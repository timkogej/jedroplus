'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Gear,
  Buildings,
} from '@phosphor-icons/react';
import type { SettingsSection } from '@/types/settings';

interface TabItem {
  id: SettingsSection;
  label: string;
  icon: React.ElementType;
  path: string;
}

const settingsTabs: TabItem[] = [
  { id: 'splosno', label: 'Splošno', icon: Gear, path: '/nastavitve/splosno' },
  { id: 'podjetje', label: 'Podjetje', icon: Buildings, path: '/nastavitve/podjetje' },
];

export function SettingsSidebar() {
  const pathname = usePathname();

  const getCurrentSection = (): SettingsSection | null => {
    for (const tab of settingsTabs) {
      if (pathname.includes(tab.path)) {
        return tab.id;
      }
    }
    return null;
  };

  const currentSection = getCurrentSection();

  return (
    <div className="flex gap-1 p-1 rounded-xl bg-gray-100 w-full">
      {settingsTabs.map((tab) => {
        const isActive = currentSection === tab.id;
        const Icon = tab.icon;

        return (
          <Link
            key={tab.id}
            href={tab.path}
            className={`relative flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
              isActive
                ? 'text-[#1A1F36]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="settings-tab-bg"
                className="absolute inset-0 bg-white rounded-lg shadow-sm"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative flex items-center gap-2">
              <Icon className="w-4 h-4" weight={isActive ? 'fill' : 'regular'} />
              {tab.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
