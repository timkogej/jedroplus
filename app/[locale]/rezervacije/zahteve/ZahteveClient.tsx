'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Clock, Envelope, Phone, CalendarBlank } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import ProtectedLayout from '@/components/ProtectedLayout';
import AmbientBottomGlow from '@/components/shared/AmbientBottomGlow';
import { useCompany } from '@/app/company-context';
import { useRolePermissions } from '@/app/role-permission-context';
import { GradientSpinner } from '@/components/ui/GradientSpinner';
import { SegmentedControl } from '@/components/settings';
import {
  fetchZahteveTermini,
  type ZahtevaTermina,
  type ZahtevaTerminaStatus,
} from '@/lib/supabase/zahteveTermini';

const ConfirmRequestModal = dynamic(
  () => import('@/components/zahteve/ConfirmRequestModal').then((m) => m.ConfirmRequestModal),
  { ssr: false }
);
const RejectRequestModal = dynamic(
  () => import('@/components/zahteve/RejectRequestModal').then((m) => m.RejectRequestModal),
  { ssr: false }
);

type FilterValue = 'all' | ZahtevaTerminaStatus;

function statusBadgeClasses(status: ZahtevaTerminaStatus) {
  switch (status) {
    case 'potrjeno':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'zavrnjeno':
      return 'bg-red-50 text-red-600 border-red-200';
    default:
      return 'bg-amber-50 text-amber-700 border-amber-200';
  }
}

export default function ZahteveClient() {
  const t = useTranslations('zahteve-termini');
  const router = useRouter();
  const { companyId, loading: companyLoading } = useCompany();
  const { role, permissions } = useRolePermissions();
  const canManage = role !== 'staff' || (permissions?.can_manage_rezervacije ?? true);

  const [zahteve, setZahteve] = useState<ZahtevaTermina[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterValue>('all');
  const [confirmTarget, setConfirmTarget] = useState<ZahtevaTermina | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ZahtevaTermina | null>(null);

  const skipAutoFetch = useRef(false);

  const loadZahteve = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const { data, error } = await fetchZahteveTermini(companyId);
    if (error) {
      toast.error(t('loadError'));
    } else {
      setZahteve(data ?? []);
    }
    setLoading(false);
  }, [companyId, t]);

  useEffect(() => {
    if (!companyLoading && !companyId) {
      router.replace('/onboarding');
    }
  }, [companyId, companyLoading, router]);

  useEffect(() => {
    if (!companyId) return;
    if (skipAutoFetch.current) {
      skipAutoFetch.current = false;
      return;
    }
    loadZahteve();
  }, [companyId, loadZahteve]);

  if (companyLoading || !companyId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <GradientSpinner />
      </div>
    );
  }

  const filteredZahteve =
    filter === 'all' ? zahteve : zahteve.filter((z) => z.status === filter);

  const filterOptions = [
    { value: 'all', label: t('filters.all') },
    { value: 'v_pregledu', label: t('filters.pending') },
    { value: 'potrjeno', label: t('filters.confirmed') },
    { value: 'zavrnjeno', label: t('filters.rejected') },
  ];

  return (
    <ProtectedLayout>
      <main className="relative isolate min-h-screen bg-white">
        <AmbientBottomGlow tone="turquoise" />
        <div className="relative z-10 mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <button
              onClick={() => router.push('/rezervacije')}
              className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" weight="bold" />
              {t('page.backLink')}
            </button>
            <h1
              className="text-3xl font-normal text-[#1A1F36]"
              style={{ fontFamily: '"Clash Display", var(--font-geist-sans), Arial, sans-serif' }}
            >
              {t('page.title')}
            </h1>
            <p className="mt-1 text-sm text-gray-500">{t('page.subtitle')}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mb-6"
          >
            <SegmentedControl options={filterOptions} value={filter} onChange={(v) => setFilter(v as FilterValue)} />
          </motion.div>

          {loading ? (
            <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-white py-20 shadow-sm">
              <GradientSpinner />
            </div>
          ) : filteredZahteve.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
              <p className="text-base font-semibold text-gray-900">{t('empty.title')}</p>
              <p className="mt-1 text-sm text-gray-500">{t('empty.subtitle')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {filteredZahteve.map((zahteva) => (
                  <motion.article
                    key={zahteva.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold text-gray-900">
                            {zahteva.ime} {zahteva.priimek}
                          </h3>
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusBadgeClasses(zahteva.status)}`}
                          >
                            {t(`status.${zahteva.status}`)}
                          </span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                          {zahteva.email && (
                            <span className="inline-flex items-center gap-1">
                              <Envelope className="h-3.5 w-3.5" weight="regular" />
                              {zahteva.email}
                            </span>
                          )}
                          {zahteva.telefon && (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="h-3.5 w-3.5" weight="regular" />
                              {zahteva.telefon}
                            </span>
                          )}
                        </div>
                      </div>

                      {zahteva.status === 'v_pregledu' && canManage && (
                        <div className="flex flex-shrink-0 gap-2">
                          <button
                            onClick={() => setRejectTarget(zahteva)}
                            className="h-9 rounded-lg border border-gray-200 px-3.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
                          >
                            {t('card.reject')}
                          </button>
                          <button
                            onClick={() => setConfirmTarget(zahteva)}
                            className="h-9 rounded-lg bg-gradient-to-r from-violet-500 to-cyan-500 px-3.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
                          >
                            {t('card.confirm')}
                          </button>
                        </div>
                      )}
                    </div>

                    {zahteva.opis_zelje && (
                      <p className="mt-3 text-sm leading-6 text-gray-700">{zahteva.opis_zelje}</p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <CalendarBlank className="h-3.5 w-3.5" weight="regular" />
                        {t('card.preferredRange', {
                          from: zahteva.zeljeni_datum_od,
                          to: zahteva.zeljeni_datum_do,
                        })}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" weight="regular" />
                        {t(`delDneva.${zahteva.zeljeni_del_dneva}`)}
                      </span>
                    </div>

                    {zahteva.status === 'zavrnjeno' && zahteva.zavrnitev_razlog && (
                      <p className="mt-2 text-xs text-red-500">
                        {t('card.rejectedReason', { reason: zahteva.zavrnitev_razlog })}
                      </p>
                    )}
                  </motion.article>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>

      {confirmTarget && (
        <ConfirmRequestModal
          zahteva={confirmTarget}
          onClose={() => setConfirmTarget(null)}
          onConfirmed={() => {
            setConfirmTarget(null);
            loadZahteve();
          }}
        />
      )}

      {rejectTarget && (
        <RejectRequestModal
          zahteva={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onRejected={() => {
            setRejectTarget(null);
            loadZahteve();
          }}
        />
      )}
    </ProtectedLayout>
  );
}
