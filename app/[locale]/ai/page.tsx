'use client';

// Stran AI: Asistent+ (glasovni asistent v aplikaciji) in Receptionist+ (telefonska
// asistentka). Receptionist+ ureja samo lastnik (kot prej na /receptionist-plus).

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import ProtectedLayout from '@/components/ProtectedLayout';
import { SegmentedControl } from '@/components/settings/SegmentedControl';
import { AsistentNastavitve } from '@/components/glas/AsistentNastavitve';
import { ReceptionistPlusPanel } from '@/components/receptionist-plus/ReceptionistPlusPanel';
import { useRolePermissions } from '@/app/role-permission-context';
import { useCompany } from '@/app/company-context';
import { useRouter } from '@/i18n/navigation';
import { imaZgodnjiDostop } from '@/lib/zgodnjiDostop';

type Del = 'asistent' | 'receptionist';

export default function AiPage() {
  const t = useTranslations('layout.aiStran');
  const { role } = useRolePermissions();
  const lastnik = role === 'owner';
  const [del, setDel] = useState<Del>('asistent');
  const router = useRouter();
  const { companyId } = useCompany();
  // Brez zgodnjega dostopa (lib/zgodnjiDostop) strani AI ni: Receptionist+ ostane na svoji strani.
  const zgodnji = imaZgodnjiDostop(companyId);
  useEffect(() => {
    if (!companyId || zgodnji) return;
    const params = new URLSearchParams(window.location.search);
    params.delete('ai');
    const q = params.toString();
    router.replace(q ? `/receptionist-plus?${q}` : '/receptionist-plus');
  }, [companyId, zgodnji, router]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('ai') === 'receptionist') setDel('receptionist');
  }, []);

  const izberi = (d: Del) => {
    setDel(d);
    const params = new URLSearchParams(window.location.search);
    params.set('ai', d);
    if (d === 'asistent') {
      params.delete('tab');
      params.delete('checkout');
    }
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
  };

  const prikazan: Del = del === 'receptionist' && !lastnik && role !== null ? 'asistent' : del;

  return (
    <ProtectedLayout>
      <main className="min-h-screen bg-white">
        {zgodnji && (
          <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
              className="mb-6"
            >
              <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">{t('naslov')}</h1>
              <p className="mt-0.5 text-base text-gray-500">{t('podnaslov')}</p>
            </motion.div>

            {lastnik && (
              <div className="mb-6">
                <SegmentedControl
                  options={[
                    { value: 'asistent', label: t('zavihki.asistent') },
                    { value: 'receptionist', label: t('zavihki.receptionist') },
                  ]}
                  value={prikazan}
                  onChange={(v) => izberi(v as Del)}
                />
              </div>
            )}

            {prikazan === 'asistent' ? <AsistentNastavitve /> : <ReceptionistPlusPanel />}
          </div>
        )}
      </main>
    </ProtectedLayout>
  );
}
