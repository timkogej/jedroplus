'use client';

// Receptionist+.
// Z zgodnjim dostopom (lib/zgodnjiDostop) je na strani AI (/ai?ai=receptionist): ta naslov
// ostane zaradi povezav v obvestilih, zaznamkov in vrnitve iz Stripa (?tab=krediti&checkout=…)
// in preusmeri tja z istimi parametri. Ostala podjetja vidijo stran kot prej.

import { useEffect } from 'react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import ProtectedLayout from '@/components/ProtectedLayout';
import { ReceptionistPlusPanel } from '@/components/receptionist-plus/ReceptionistPlusPanel';
import { useCompany } from '@/app/company-context';
import { imaZgodnjiDostop } from '@/lib/zgodnjiDostop';

export default function ReceptionistPlusPage() {
  const t = useTranslations('receptionist');
  const router = useRouter();
  const { companyId } = useCompany();
  const zgodnji = imaZgodnjiDostop(companyId);

  useEffect(() => {
    if (!zgodnji) return;
    const params = new URLSearchParams(window.location.search);
    params.set('ai', 'receptionist');
    router.replace(`/ai?${params.toString()}`);
  }, [router, zgodnji]);

  return (
    <ProtectedLayout>
      <main className="min-h-screen bg-white">
        {companyId && !zgodnji && (
          <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
              className="mb-6"
            >
              <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">{t('title')}</h1>
              <p className="mt-0.5 text-base text-gray-500">{t('subtitle')}</p>
            </motion.div>
            <ReceptionistPlusPanel />
          </div>
        )}
      </main>
    </ProtectedLayout>
  );
}
