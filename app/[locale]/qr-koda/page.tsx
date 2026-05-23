'use client';

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import ProtectedLayout from '@/components/ProtectedLayout';
import { useCompany } from '@/app/company-context';
import { supabaseReadOnly } from '@/src/lib/supabaseReadOnly';
import { QRCodeCard } from '@/components/qr/QRCodeCard';
import { GradientSpinner } from '@/components/ui/GradientSpinner';

export default function QrKodaPage() {
  const { companyId } = useCompany();
  const [slug, setSlug] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadSlug() {
      if (!companyId) return;
      setIsLoading(true);
      try {
        const { data } = await supabaseReadOnly
          .from('companies')
          .select('slug')
          .eq('company_id', companyId)
          .maybeSingle();
        if (data?.slug) setSlug(String(data.slug));
      } catch (e) {
        console.error('Failed to load slug:', e);
      } finally {
        setIsLoading(false);
      }
    }
    loadSlug();
  }, [companyId]);

  if (!companyId || isLoading) {
    return (
      <ProtectedLayout>
        <main className="flex min-h-screen items-center justify-center bg-white">
          <GradientSpinner />
        </main>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <main className="mx-auto w-full max-w-[1800px] px-4 py-8 sm:px-6 lg:px-8 bg-white min-h-screen">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            QR koda za registracijo strank
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Stranke skenirajo to kodo in izpolnijo svoje podatke.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="flex justify-center"
        >
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            {slug ? (
              <QRCodeCard slug={slug} size={280} showInfo />
            ) : (
              <p className="text-sm text-gray-400 py-8">Slug podjetja ni nastavljen.</p>
            )}
          </div>
        </motion.div>
      </main>
    </ProtectedLayout>
  );
}
