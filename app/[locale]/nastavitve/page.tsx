'use client';

import { Link } from '@/i18n/navigation';
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
        <h1 className="text-2xl font-semibold text-gray-900">{t('hub.title')}</h1>
        <p className="mt-0.5 text-base text-gray-500">{t('hub.subtitle')}</p>
      </div>

      {/* Applov seznam: vrstica visoka vsaj 44 px, kljukica desno, ločnica
          zamaknjena za ikono — začne se šele pod besedilom, ne pod ikono. */}
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
        {visibleItems.map((item, index) => {
          const Icon = item.icon;
          const menuKey = menuKeyMap[item.id];
          const isLast = index === visibleItems.length - 1;
          return (
            <Link
              key={item.id}
              href={item.path}
              className="group relative flex min-h-[44px] items-center gap-3.5 px-4 py-3 transition-colors hover:bg-gray-50 active:bg-gray-100"
            >
              <Icon
                weight="regular"
                className="h-[18px] w-[18px] flex-shrink-0 text-gray-400 transition-colors duration-150 group-hover:text-gray-600"
              />
              <div className="min-w-0 flex-1">
                <p className="text-base font-medium text-gray-900">{t(`hub.menu.${menuKey}.label`)}</p>
                <p className="mt-0.5 text-sm text-gray-500">{t(`hub.menu.${menuKey}.description`)}</p>
              </div>
              <CaretRight
                weight="bold"
                className="h-3.5 w-3.5 flex-shrink-0 text-gray-300 transition-colors duration-150 group-hover:text-gray-400"
              />
              {!isLast && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 left-[3.25rem] right-0 h-px bg-gray-100"
                />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
