'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Gear,
  Buildings,
  UsersThree,
  ChatTeardrop,
} from '@phosphor-icons/react';
import type { SettingsSection } from '@/types/settings';
import { supabaseReadOnly } from '@/src/lib/supabaseReadOnly';
import { useCompany } from '@/app/company-context';
import { useAuth } from '@/app/auth-context';

interface TabItem {
  id: SettingsSection;
  label: string;
  icon: React.ElementType;
  path: string;
  ownerOnly?: boolean;
}

const settingsTabs: TabItem[] = [
  { id: 'podjetje', label: 'Podjetje', icon: Buildings, path: '/nastavitve/podjetje' },
  { id: 'splosno', label: 'Splošno', icon: Gear, path: '/nastavitve/splosno' },
  { id: 'clani', label: 'Člani', icon: UsersThree, path: '/nastavitve/clani', ownerOnly: true },
  { id: 'sporocila', label: 'Sporočila', icon: ChatTeardrop, path: '/nastavitve/sporocila' },
];

export function SettingsSidebar() {
  const pathname = usePathname();
  const { companyUuid } = useCompany();
  const { user } = useAuth();

  // Initialise from localStorage so there's no pop-in on re-visits
  const cacheKey = companyUuid && user?.id ? `owner_${companyUuid}_${user.id}` : null;
  const [isOwner, setIsOwner] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !cacheKey) return false;
    return localStorage.getItem(cacheKey) === '1';
  });

  useEffect(() => {
    if (!companyUuid || !user?.id || !cacheKey) return;
    supabaseReadOnly
      .from('company_members')
      .select('role')
      .eq('company_id', companyUuid)
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        const owner = data?.role === 'owner';
        setIsOwner(owner);
        localStorage.setItem(cacheKey, owner ? '1' : '0');
      });
  }, [companyUuid, user?.id, cacheKey]);

  const visibleTabs = settingsTabs.filter(
    (tab) => !tab.ownerOnly || isOwner
  );

  const getCurrentSection = (): SettingsSection | null => {
    for (const tab of visibleTabs) {
      if (pathname.includes(tab.path)) {
        return tab.id;
      }
    }
    return null;
  };

  const currentSection = getCurrentSection();

  return (
    <div className="flex gap-1 p-1 rounded-xl bg-gray-100 w-full">
      {visibleTabs.map((tab) => {
        const isActive = currentSection === tab.id;
        const Icon = tab.icon;

        return (
          <Link
            key={tab.id}
            href={tab.path}
            className={`relative flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
              isActive
                ? 'text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="settings-tab-bg"
                className="absolute inset-0 bg-white rounded-lg"
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
