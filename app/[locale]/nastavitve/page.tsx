'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Buildings, Gear, UsersThree, ChatTeardrop, Package, Stack, CaretRight, ClockCounterClockwise } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { supabaseReadOnly } from '@/src/lib/supabaseReadOnly';
import { useCompany } from '@/app/company-context';
import { useAuth } from '@/app/auth-context';

type MenuId = 'podjetje' | 'splosno' | 'clani' | 'paketi' | 'sporocila' | 'addoni' | 'zgodovina';

const menuItems: { id: MenuId; icon: typeof Buildings; path: string; ownerOnly: boolean }[] = [
  { id: 'podjetje', icon: Buildings,    path: '/nastavitve/podjetje', ownerOnly: false },
  { id: 'splosno',  icon: Gear,         path: '/nastavitve/splosno',  ownerOnly: false },
  { id: 'clani',    icon: UsersThree,   path: '/nastavitve/clani',    ownerOnly: true  },
  { id: 'paketi',   icon: Package,      path: '/nastavitve/paketi',   ownerOnly: true  },
  { id: 'sporocila',icon: ChatTeardrop, path: '/nastavitve/sporocila',ownerOnly: false },
  { id: 'addoni',   icon: Stack,                  path: '/nastavitve/addoni',    ownerOnly: true  },
  { id: 'zgodovina', icon: ClockCounterClockwise, path: '/nastavitve/zgodovina', ownerOnly: false },
];

const menuKeyMap: Record<MenuId, string> = {
  podjetje:  'company',
  splosno:   'general',
  clani:     'members',
  paketi:    'plans',
  sporocila: 'messages',
  addoni:    'addons',
  zgodovina: 'history',
};

export default function SettingsPage() {
  const t = useTranslations('settings');
  const { companyUuid } = useCompany();
  const { user } = useAuth();

  const cacheKey = companyUuid && user?.id ? `owner_${companyUuid}_${user.id}` : null;
  const [isOwner, setIsOwner] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !cacheKey) return false;
    return localStorage.getItem(cacheKey) === '1';
  });

  useEffect(() => {
    if (!companyUuid || !user?.id || !cacheKey) return;
    // Apply cached value immediately so the correct item count shows on first render
    const cached = localStorage.getItem(cacheKey);
    if (cached !== null) setIsOwner(cached === '1');
    // Then verify with DB and update if needed
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

  const visibleItems = menuItems.filter((item) => !item.ownerOnly || isOwner);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">{t('hub.title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('hub.subtitle')}</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 px-5">
        {visibleItems.map((item, index) => {
          const Icon = item.icon;
          const menuKey = menuKeyMap[item.id];
          const isLast = index === visibleItems.length - 1;
          return (
            <Link
              key={item.id}
              href={item.path}
              className={`group flex items-center gap-4 py-4${!isLast ? ' border-b border-gray-100' : ''}`}
            >
              <Icon className="w-5 h-5 text-gray-400 group-hover:text-gray-900 transition-colors duration-150 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{t(`hub.menu.${menuKey}.label`)}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t(`hub.menu.${menuKey}.description`)}</p>
              </div>
              <CaretRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors duration-150 flex-shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
