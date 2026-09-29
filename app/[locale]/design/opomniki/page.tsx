"use client";

/**
 * ZAČASNA predogledna stran za redizajn Opomnikov.
 *
 * Uporablja iste gradnike kot prava stran (OverviewPrimitives), samo s
 * podtaknjenimi podatki. Ko je redizajn potrjen, se mapa `design` zbriše.
 */

import { motion } from "motion/react";
import {
  Bell,
  Gear,
  CheckCircle,
  Clock,
  EnvelopeSimple,
  Palette,
  ChatText,
  Warning,
} from "@phosphor-icons/react";
import {
  StatusPill,
  ValuePill,
  SettingRow,
  SectionPanel,
  DetailBlock,
  PlainMeta,
  FlowStep,
  ColorSwatches,
} from "@/components/reminders/OverviewPrimitives";

export default function OpomnikiDesignPreview() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
          className="mb-7 flex flex-wrap items-start justify-between gap-4"
        >
          <div className="max-w-2xl">
            <div className="mb-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
              predogled
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">
              Opomniki
            </h1>
            <p className="mt-0.5 text-base text-gray-500">
              Samodejna sporočila strankam pred terminom, po njem in ob
              prestavitvi.
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

        <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wider text-gray-500">
          Stanje pošiljanja
        </h2>
        <div className="mb-7 grid gap-2 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-xl border border-gray-100 bg-white p-4 text-sm text-gray-700">
            <CheckCircle
              size={18}
              weight="regular"
              className="mt-0.5 shrink-0"
            />
            <div className="min-w-0 space-y-1">
              <p className="font-semibold">SMS se pošiljajo</p>
              <p className="text-xs leading-5 opacity-90">
                Porabljenih 128 od 500 v tem obdobju.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900">
            <Warning size={18} weight="regular" className="mt-0.5 shrink-0" />
            <div className="min-w-0 space-y-1">
              <p className="font-semibold">Email se bliža meji</p>
              <p className="text-xs leading-5 opacity-90">
                Ostalo je še 40 sporočil. Obnovi se 1. 11. 2026.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <SectionPanel title="Potek">
            <FlowStep
              icon={<Bell size={20} weight="regular" />}
              eyebrow="Korak 1"
              title="Opomnik pred terminom"
              editLabel="Uredi"
              onEdit={() => {}}
              enabled
              statusLabel="Omogočeno"
            >
              <div className="space-y-1.5">
                <PlainMeta label="Kanal">SMS</PlainMeta>
                <PlainMeta label="Kdaj">24 ur pred terminom</PlainMeta>
                <PlainMeta label="Vrsta">Samodejno sestavljeno</PlainMeta>
              </div>
              <DetailBlock label="Upošteva">
                <div className="space-y-1">
                  <p className="text-sm text-gray-900">Ime storitve</p>
                  <p className="text-sm text-gray-900">Izvajalca</p>
                  <p className="text-sm text-gray-900">Navodila pred obiskom</p>
                </div>
              </DetailBlock>
              <DetailBlock label="Navodila">
                <p className="whitespace-pre-wrap break-words">
                  Stranko naj se spomni, da pride 5 minut prej in da naj sporoči
                  morebitne alergije.
                </p>
              </DetailBlock>
            </FlowStep>

            <FlowStep
              icon={<CheckCircle size={20} weight="regular" />}
              eyebrow="Korak 2"
              title="Sporočilo po terminu"
              editLabel="Uredi"
              onEdit={() => {}}
              enabled
              statusLabel="Omogočeno"
            >
              <div className="space-y-1.5">
                <PlainMeta label="Kanal">Email</PlainMeta>
                <PlainMeta label="Kdaj">2 uri po terminu</PlainMeta>
              </div>
              <DetailBlock label="Popust">
                <p className="whitespace-pre-wrap break-words">
                  10 % na naslednji obisk, velja 30 dni.
                </p>
              </DetailBlock>
            </FlowStep>

            <FlowStep
              icon={<Clock size={20} weight="regular" />}
              eyebrow="Korak 3"
              title="Obvestilo o prestavitvi"
              editLabel="Uredi"
              onEdit={() => {}}
              enabled={false}
              statusLabel="Onemogočeno"
            >
              <p className="text-sm text-gray-500">
                Obvestilo o prestavitvi je izklopljeno. Stranke ob spremembi
                termina ne dobijo sporočila.
              </p>
            </FlowStep>
          </SectionPanel>

          <SectionPanel title="Jezik in ton">
            <SettingRow
              icon={<ChatText size={16} weight="regular" />}
              label="Jezik pošiljanja"
              description="V tem jeziku so napisana vsa sporočila strankam."
              value={<ValuePill>Slovenščina</ValuePill>}
            />
            <SettingRow
              icon={<ChatText size={16} weight="regular" />}
              label="Ton komunikacije"
              description="Kako sporočila zvenijo — bolj sproščeno ali bolj uradno."
              value={<ValuePill>Prijazno</ValuePill>}
            />
            <SettingRow
              icon={<ChatText size={16} weight="regular" />}
              label="Nagovor strank"
              description={'Ali stranko nagovorimo s "ti" ali z "vi".'}
              value={<ValuePill>Vikanje</ValuePill>}
            />
          </SectionPanel>

          <SectionPanel title="Pošiljatelj">
            <SettingRow
              icon={<EnvelopeSimple size={16} weight="regular" />}
              label="Reply-to Email"
              description="Na ta naslov pridejo odgovori strank na e-pošto."
              value={<span className="break-words">salon@example.com</span>}
            />
            <SettingRow
              icon={<EnvelopeSimple size={16} weight="regular" />}
              label="Ime pošiljatelja"
              description="Ime ki se prikaže pri email kot pošiljatelj"
              value={<span className="break-words">Salon Jedro</span>}
            />
            <SettingRow
              icon={<ChatText size={16} weight="regular" />}
              label="ID Pošiljatelja SMS"
              description="Uporablja se pri SMS pošiljanju"
              value={<span className="text-gray-400">Ni nastavljeno</span>}
            />
          </SectionPanel>

          <SectionPanel title="Vsebina sporočila">
            <SettingRow
              icon={<Bell size={16} weight="regular" />}
              label="Oznaka samodejni opomnik"
              description="Sporočilu doda pripis, da je bilo poslano samodejno."
              value={<StatusPill enabled label="Omogočeno" />}
            />
            <SettingRow
              icon={<CheckCircle size={16} weight="regular" />}
              label="Izvajalec v opomniku"
              description="V opomnik zapiše, kdo bo storitev opravil."
              value={<StatusPill enabled={false} label="Onemogočeno" />}
            />
            <SettingRow
              icon={<ChatText size={16} weight="regular" />}
              label="Nasveti glede na storitev"
              description="Sporočilu doda nasvet, povezan z naročeno storitvijo."
              value={<ValuePill>Vklopljeno</ValuePill>}
            />
          </SectionPanel>

          <SectionPanel title="Videz e-pošte">
            <SettingRow
              icon={<Palette size={16} weight="regular" />}
              label="Barve emaila"
              description="Barvi glave in gumbov v e-poštnih sporočilih."
              value={
                <ColorSwatches
                  colors={["#7C78FA", "#35E3DB"]}
                  emptyLabel="Ni nastavljeno"
                />
              }
            />
          </SectionPanel>

          <SectionPanel title="Kako deluje">
            <div className="p-4">
              <p className="whitespace-pre-wrap text-sm leading-7 text-gray-600">
                Opomniki se{" "}
                <span className="font-semibold text-gray-900">
                  pošiljajo samodejno
                </span>
                , brez tvojega posredovanja. Sporočilo se sestavi tik pred
                pošiljanjem, tako da vsebuje zadnje podatke o terminu.
              </p>
            </div>
          </SectionPanel>
        </div>
      </div>
    </main>
  );
}
