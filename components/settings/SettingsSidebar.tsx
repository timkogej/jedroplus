'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Gear,
  Buildings,
  CalendarBlank,
  Robot,
  Bell,
  TrendDown,
  Phone,
} from '@phosphor-icons/react';
import type { SettingsSection } from '@/types/settings';

interface SidebarItem {
  id: SettingsSection;
  label: string;
  icon: React.ElementType;
  path: string;
}

const settingsSections: SidebarItem[] = [
  { id: 'splosno', label: 'Splošno', icon: Gear, path: '/nastavitve/splosno' },
  { id: 'podjetje', label: 'Podjetje', icon: Buildings, path: '/nastavitve/podjetje' },
  { id: 'rezervacije', label: 'Rezervacije', icon: CalendarBlank, path: '/nastavitve/rezervacije' },
  { id: 'chatbot', label: 'Chatbot+', icon: Robot, path: '/nastavitve/chatbot' },
  { id: 'opomniki', label: 'Opomniki', icon: Bell, path: '/nastavitve/opomniki' },
  { id: 'lost-leads', label: 'Lost Leads', icon: TrendDown, path: '/nastavitve/lost-leads' },
  { id: 'receptionist', label: 'Receptionist+', icon: Phone, path: '/nastavitve/receptionist' },
];

export function SettingsSidebar() {
  const pathname = usePathname();

  const getCurrentSection = (): SettingsSection | null => {
    for (const section of settingsSections) {
      if (pathname.includes(section.path)) {
        return section.id;
      }
    }
    return null;
  };

  const currentSection = getCurrentSection();

  return (
    <nav className="w-full lg:w-64 bg-gray-50/50 lg:min-h-screen p-4 lg:sticky lg:top-0">
      <div className="space-y-1">
        {settingsSections.map((section) => {
          const isActive = currentSection === section.id;
          const Icon = section.icon;

          return (
            <Link
              key={section.id}
              href={section.path}
              className={`
                relative flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200
                ${isActive
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-600 hover:bg-white/60 hover:text-gray-900'
                }
              `}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-indicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-purple-500 to-pink-500 rounded-r-full"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <Icon className="w-5 h-5" weight={isActive ? 'fill' : 'regular'} />
              <span className="font-medium text-sm">{section.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
