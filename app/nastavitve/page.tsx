'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Buildings, Gear, UsersThree, ChatTeardrop, Package, CaretRight } from '@phosphor-icons/react';
import { supabaseReadOnly } from '@/src/lib/supabaseReadOnly';
import { useCompany } from '@/app/company-context';
import { useAuth } from '@/app/auth-context';

const menuItems = [
  {
    id: 'podjetje',
    label: 'Podjetje',
    description: 'Naziv, naslov, delovni čas in kontaktni podatki',
    icon: Buildings,
    path: '/nastavitve/podjetje',
    ownerOnly: false,
  },
  {
    id: 'splosno',
    label: 'Splošno',
    description: 'Račun, jezik, obvestila in kode podjetja',
    icon: Gear,
    path: '/nastavitve/splosno',
    ownerOnly: false,
  },
  {
    id: 'clani',
    label: 'Člani',
    description: 'Ekipa, vloge in dovoljenja za zaposlene',
    icon: UsersThree,
    path: '/nastavitve/clani',
    ownerOnly: true,
  },
  {
    id: 'paketi',
    label: 'Paketi in kvote',
    description: 'Pregled vašega paketa in mesečne porabe',
    icon: Package,
    path: '/nastavitve/paketi',
    ownerOnly: true,
  },
  {
    id: 'sporocila',
    label: 'Sporočila',
    description: 'Zgodovina poslanih sporočil in opomnikov',
    icon: ChatTeardrop,
    path: '/nastavitve/sporocila',
    ownerOnly: false,
  },
];

export default function SettingsPage() {
  const { companyUuid } = useCompany();
  const { user } = useAuth();

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

  const visibleItems = menuItems.filter((item) => !item.ownerOnly || isOwner);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Nastavitve</h1>
        <p className="text-sm text-gray-500 mt-1">Vse nastavitve, organizirane po sklopih.</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 px-5">
        {visibleItems.map((item, index) => {
          const Icon = item.icon;
          const isLast = index === visibleItems.length - 1;
          return (
            <Link
              key={item.id}
              href={item.path}
              className={`group flex items-center gap-4 py-4${!isLast ? ' border-b border-gray-100' : ''}`}
            >
              <Icon className="w-5 h-5 text-gray-400 group-hover:text-gray-900 transition-colors duration-150 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{item.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
              </div>
              <CaretRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors duration-150 flex-shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
