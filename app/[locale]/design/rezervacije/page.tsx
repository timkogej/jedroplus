'use client';

/**
 * ZAČASNA predogledna stran za redizajn Rezervacij.
 *
 * Uporablja prave komponente (DesignCard, gradnike pregleda) z izmišljenimi
 * podatki. Ko je redizajn potrjen, se mapa `design` zbriše.
 */

import { useState } from 'react';
import { motion } from 'motion/react';
import {
  Gear,
  Warning,
  ClipboardText,
  CaretRight,
  Palette,
  Link as LinkIcon,
  CheckCircle,
  Clock,
  Copy,
  Check,
  ArrowSquareOut,
} from '@phosphor-icons/react';
import { DesignCard } from '@/components/reservations/DesignCard';
import { STANDARD_DESIGNS, PREMIUM_DESIGNS } from '@/lib/reservations/bookingDesigns';
import { SectionPanel, SettingRow, StatusPill, ValuePill } from '@/components/ui/OverviewPrimitives';

const MAIN_LINK = 'https://rezervacije.jedroplus.com/salon-jedro';
const MGMT_LINK = 'https://rezervacije.jedroplus.com/salon-jedro/moj-termin';

export default function RezervacijeDesignPreview() {
  const [copied, setCopied] = useState<number | null>(null);

  const copy = (url: string, id: number) => {
    if (url) navigator.clipboard.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
          className="mb-7 flex flex-wrap items-start justify-between gap-4"
        >
          <div>
            <div className="mb-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
              predogled
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">Rezervacije</h1>
            <p className="mt-0.5 text-base text-gray-500">
              Spletne rezervacijske strani, ki jih delite strankam.
            </p>
          </div>
          <button
            type="button"
            className="relative inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 active:bg-gray-100"
          >
            <Gear size={17} weight="regular" className="text-gray-500" />
            Nastavitve
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-white bg-amber-500 text-[9px] font-bold leading-none text-white">
              !
            </span>
          </button>
        </motion.div>

        <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50 p-4">
          <Warning size={18} weight="regular" className="flex-shrink-0 text-amber-600" />
          <p className="flex-1 text-sm font-medium text-amber-900">
            Izbrali ste dizajn, glavni booking link pa še ni nastavljen.
          </p>
          <button className="flex-shrink-0 text-xs font-semibold text-amber-900 underline underline-offset-4 hover:text-amber-700">
            Odpri nastavitve
          </button>
        </div>

        <button
          type="button"
          className="mb-3 flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 text-left transition-colors hover:bg-gray-50 active:bg-gray-100"
        >
          <ClipboardText className="h-5 w-5 flex-shrink-0 text-gray-400" weight="regular" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900">Zahteve za termin</p>
            <p className="mt-0.5 text-[13px] text-gray-500">3 čakajo na pregled</p>
          </div>
          <CaretRight className="h-4 w-4 flex-shrink-0 text-gray-300" weight="bold" />
        </button>

        <div className="mb-6 grid gap-3 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="flex items-center gap-3 rounded-xl border border-violet-100 bg-violet-50 p-4">
            <Palette className="h-5 w-5 flex-shrink-0 text-violet-600" weight="regular" />
            <p className="text-sm font-medium text-violet-900">Novi dizajni so na voljo</p>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-gray-100 bg-white p-4">
            <LinkIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-400" weight="regular" />
            <p className="text-sm leading-6 text-gray-600">
              <span className="font-semibold text-gray-900">Vsako povezavo lahko delite posebej.</span>{' '}
              Tako veste, od kod je prišla rezervacija.
            </p>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-gray-100 bg-white p-5">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="mb-1 text-[15px] font-semibold text-gray-900">Standardne strani</h2>
              <p className="text-sm text-gray-500">Vključene v vsak paket.</p>
            </div>
            <div className="flex gap-1.5">
              {STANDARD_DESIGNS.map((d) => (
                <span key={d.id} className="h-2.5 w-2.5 rounded-full" style={{ background: d.accent }} />
              ))}
            </div>
          </div>
          <div className="-mx-5 flex gap-4 overflow-x-auto px-5 pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0 xl:grid-cols-3">
            {STANDARD_DESIGNS.map((design) => (
              <DesignCard
                key={design.id}
                design={design}
                isCopied={copied === design.id}
                onCopy={copy}
                designUrl={`${MAIN_LINK}-${design.designKey}`}
              />
            ))}
          </div>
        </div>

        <div className="mb-8 rounded-xl border border-gray-100 bg-white p-5">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h2 className="text-[15px] font-semibold text-gray-900">Premium strani</h2>
                <span
                  className="rounded-md px-2 py-0.5 text-xs font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg, #8B5CF6, #3B82F6, #06B6D4)' }}
                >
                  PRO
                </span>
              </div>
              <p className="text-sm text-gray-500">Na voljo v paketu Jedro Pro.</p>
            </div>
            <div className="flex gap-1.5">
              {PREMIUM_DESIGNS.map((d) => (
                <span key={d.id} className="h-2.5 w-2.5 rounded-full" style={{ background: d.accent }} />
              ))}
            </div>
          </div>
          <div className="-mx-5 flex gap-4 overflow-x-auto px-5 pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0 xl:grid-cols-3">
            {PREMIUM_DESIGNS.map((design) => (
              <DesignCard
                key={design.id}
                design={design}
                isCopied={copied === design.id}
                onCopy={copy}
                designUrl={`${MAIN_LINK}-${design.designKey}`}
              />
            ))}
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-gray-100 bg-white p-5">
          <div className="mb-1 flex items-center gap-2">
            <LinkIcon className="h-5 w-5 text-gray-400" weight="regular" />
            <h2 className="text-[15px] font-semibold text-gray-900">Glavni booking link</h2>
          </div>
          <p className="mb-3 text-[13px] text-gray-500">Tega delite strankam.</p>
          <div className="flex items-center gap-2 rounded-xl bg-gray-50 p-3">
            <div className="min-w-0 flex-1">
              <span className="block truncate text-sm text-[#7C78FA]">{MAIN_LINK}</span>
            </div>
            <div className="flex flex-shrink-0 gap-1.5">
              <button className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs transition-colors hover:bg-gray-100">
                {copied === -1 ? (
                  <>
                    <Check className="h-3 w-3 text-green-500" weight="bold" />
                    <span className="text-green-600">Kopirano</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 text-gray-500" weight="regular" />
                    <span className="text-gray-600">Kopiraj</span>
                  </>
                )}
              </button>
              <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-violet-500 to-cyan-500 text-white shadow-sm transition-opacity hover:opacity-90">
                <ArrowSquareOut className="h-3.5 w-3.5" weight="bold" />
              </button>
            </div>
          </div>
        </div>

        <SectionPanel title="Nastavitve">
          <SettingRow
            icon={<CheckCircle size={16} weight="regular" />}
            label="Spletne rezervacije"
            description="Ali stranke lahko rezervirajo termin prek spleta."
            value={<StatusPill enabled label="Omogočeno" />}
          />
          <SettingRow
            icon={<Clock size={16} weight="regular" />}
            label="Časovni intervali"
            description="Na koliko minut se ponudi naslednji prosti termin."
            value={<ValuePill>15 min</ValuePill>}
          />
          <SettingRow
            icon={<CheckCircle size={16} weight="regular" />}
            label="Potrdilo stranki"
            description="Stranka po rezervaciji prejme potrdilo termina."
            value={
              <span className="inline-flex items-center gap-2">
                <ValuePill>SMS</ValuePill>
                <StatusPill enabled label="Da" />
              </span>
            }
          />
          <SettingRow
            icon={<CheckCircle size={16} weight="regular" />}
            label="Potrdilo po spletni rezervaciji"
            description="Potrdilo za termine, rezervirane prek spletne strani."
            value={<StatusPill enabled={false} label="Ne" />}
          />
          <div className="border-b border-gray-100 p-4 last:border-b-0">
            <div className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
              Stranke, ki rezervirajo prek spleta, ne dobijo potrdila in ne vedo, ali je termin sprejet.{' '}
              <button className="font-semibold underline underline-offset-4 hover:text-amber-700">
                Vklopi potrdilo
              </button>
            </div>
          </div>
          <SettingRow
            icon={<LinkIcon size={16} weight="regular" />}
            label="Glavni booking link"
            description="Povezava, ki jo delite strankam za rezervacijo."
            value={<ValuePill tone="blue">Nastavljen</ValuePill>}
          />
          <SettingRow
            icon={<Palette size={16} weight="regular" />}
            label="Barve"
            description="Barve rezervacijske strani, ki jo vidijo stranke."
            value={
              <span className="inline-flex gap-1.5">
                {['#7C78FA', '#35E3DB', '#F8FAFC', '#EEF2FF'].map((c) => (
                  <span key={c} className="h-5 w-5 rounded-md ring-1 ring-black/10" style={{ backgroundColor: c }} />
                ))}
              </span>
            }
          />
          <SettingRow
            icon={<LinkIcon size={16} weight="regular" />}
            label="Link za prenaročanje in odpoved"
            description="Prek te povezave stranka prestavi ali odpove termin."
            value={
              <span className="block max-w-[16rem] truncate text-sm font-medium text-[#7C78FA]">
                {MGMT_LINK}
              </span>
            }
          />
        </SectionPanel>
      </div>
    </main>
  );
}
