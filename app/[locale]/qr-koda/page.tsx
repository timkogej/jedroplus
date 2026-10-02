'use client';

/**
 * QR kode podjetja.
 *
 * Dve različni stvari, ki sta se prej mešali:
 *   • rezervacija termina → `main_booking_link` (ena sama, podjetje jo izbere
 *     med šestimi videzi v nastavitvah rezervacij),
 *   • vpis nove stranke → `client.jedroplus.com/<slug>` (obrazec s podatki,
 *     termina ne rezervira).
 *
 * Povezav za rezervacijo je v bazi šest, ena za vsak videz strani. QR koda
 * namenoma kaže samo na glavno: šest kod na pultu nihče ne bere, in če
 * podjetje kasneje zamenja videz, ostane natisnjena koda prava, ker se
 * zamenja samo vrednost `main_booking_link`.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { QrCode, CalendarCheck, UserPlus, Warning } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import ProtectedLayout from '@/components/ProtectedLayout';
import { useCompany } from '@/app/company-context';
import { loadCompanyRow } from '@/lib/settingsStore';
import { QRCodeCard } from '@/components/qr/QRCodeCard';
import {
  QrPlakatList,
  QrPlakatPrenos,
  plakatSlogi,
  PLAKAT_SIRINA,
  PLAKAT_VISINA,
  type PlakatVidez,
} from '@/components/qr/QrPlakat';
import { GradientSpinner } from '@/components/ui/GradientSpinner';
import { parseReservationSettings } from '@/lib/reservations/reservationSettings';

const VIDEZI: PlakatVidez[] = ['cisti', 'barve', 'eleganten', 'temen'];

/** Predogled je pomanjšan plakat, da se vidi prava razporeditev, ne približek. */
const PREDOGLED_MERILO = 0.52;

export default function QrKodaPage() {
  const t = useTranslations('reservations.qr');
  const router = useRouter();
  const { companyId, loading: companyLoading } = useCompany();

  const [slug, setSlug] = useState('');
  const [naziv, setNaziv] = useState('');
  const [bookingLink, setBookingLink] = useState('');
  const [barve, setBarve] = useState({ primary: '#8B5CF6', bgFrom: '#8B5CF6', bgTo: '#06B6D4' });
  const [videz, setVidez] = useState<PlakatVidez>('cisti');
  const [nalaga, setNalaga] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    let odpovedano = false;

    (async () => {
      setNalaga(true);
      try {
        const { data } = await loadCompanyRow(companyId);
        if (odpovedano) return;
        const nastavitve = parseReservationSettings(data);
        setSlug(String(data?.['slug'] ?? ''));
        setNaziv(String(data?.['Naziv Podjetja'] ?? ''));
        setBookingLink(nastavitve.mainBookingLink.trim());
        setBarve({
          primary: nastavitve.primaryColor,
          bgFrom: nastavitve.bgFromColor,
          bgTo: nastavitve.bgToColor,
        });
      } catch (e) {
        console.error('QR: nalaganje podatkov podjetja ni uspelo:', e);
      } finally {
        if (!odpovedano) setNalaga(false);
      }
    })();

    return () => {
      odpovedano = true;
    };
  }, [companyId]);

  useEffect(() => {
    if (!companyLoading && !companyId) router.replace('/onboarding');
  }, [companyId, companyLoading, router]);

  if (!companyId || nalaga) {
    return (
      <ProtectedLayout>
        <main className="flex min-h-screen items-center justify-center bg-white">
          <GradientSpinner />
        </main>
      </ProtectedLayout>
    );
  }

  const slogi = plakatSlogi(barve.primary, barve.bgFrom, barve.bgTo);
  const poziv = t('poster.cta');
  const imeZaDatoteko = `qr-rezervacija-${slug || companyId}`;

  return (
    <ProtectedLayout>
      <main className="mx-auto min-h-screen w-full max-w-[1800px] bg-white px-4 py-8 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-2">
            <QrCode className="h-6 w-6 text-gray-400" weight="regular" />
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{t('title')}</h1>
          </div>
          <p className="mt-1 text-sm text-gray-500">{t('subtitle')}</p>
        </motion.div>

        {/* ── Rezervacija termina ─────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
        >
          <div className="mb-1 flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-gray-400" weight="regular" />
            <h2 className="text-[15px] font-semibold text-gray-900">{t('booking.title')}</h2>
          </div>
          <p className="mb-5 text-[13px] text-gray-500">{t('booking.subtitle')}</p>

          {bookingLink ? (
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
              {/* Izbira videza */}
              <div className="flex-1">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {t('poster.chooseLook')}
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
                  {VIDEZI.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setVidez(v)}
                      aria-pressed={videz === v}
                      className={`overflow-hidden rounded-xl border-2 p-2 text-left transition-colors ${
                        videz === v
                          ? 'border-[#7C78FA] bg-[#7C78FA]/5'
                          : 'border-gray-100 hover:border-gray-200'
                      }`}
                    >
                      <div
                        className="mx-auto overflow-hidden rounded-lg"
                        style={{
                          width: PLAKAT_SIRINA * 0.26,
                          height: PLAKAT_VISINA * 0.26,
                        }}
                      >
                        <QrPlakatList
                          url={bookingLink}
                          naziv={naziv}
                          poziv={poziv}
                          slog={slogi[v]}
                          merilo={0.26}
                        />
                      </div>
                      <span className="mt-2 block text-center text-xs font-medium text-gray-600">
                        {t(`poster.looks.${v}`)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Predogled izbranega + prenos */}
              <div className="flex flex-col items-center gap-5">
                <div
                  className="overflow-hidden rounded-xl border border-gray-200 shadow-sm"
                  style={{
                    width: PLAKAT_SIRINA * PREDOGLED_MERILO,
                    height: PLAKAT_VISINA * PREDOGLED_MERILO,
                  }}
                >
                  <QrPlakatList
                    url={bookingLink}
                    naziv={naziv}
                    poziv={poziv}
                    slog={slogi[videz]}
                    merilo={PREDOGLED_MERILO}
                  />
                </div>
                <p className="text-xs text-gray-400">{t('poster.format')}</p>
                <QrPlakatPrenos
                  url={bookingLink}
                  naziv={naziv}
                  poziv={poziv}
                  slog={slogi[videz]}
                  imeDatoteke={imeZaDatoteko}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
              <Warning className="mt-0.5 h-5 w-5 flex-shrink-0" weight="fill" />
              <div>
                <p>{t('booking.noMainLink')}</p>
                <button
                  type="button"
                  onClick={() => router.push('/rezervacije')}
                  className="mt-2 font-semibold underline underline-offset-2 hover:opacity-70"
                >
                  {t('booking.goToReservations')}
                </button>
              </div>
            </div>
          )}
        </motion.section>

        {/* ── Vpis nove stranke ───────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
        >
          <div className="mb-1 flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-gray-400" weight="regular" />
            <h2 className="text-[15px] font-semibold text-gray-900">
              {t('registration.title')}
            </h2>
          </div>
          <p className="mb-5 text-[13px] text-gray-500">{t('registration.subtitle')}</p>

          <div className="flex justify-center">
            {slug ? (
              <QRCodeCard slug={slug} size={220} showInfo />
            ) : (
              <p className="py-6 text-sm text-gray-400">{t('registration.noSlug')}</p>
            )}
          </div>
        </motion.section>
      </main>
    </ProtectedLayout>
  );
}
