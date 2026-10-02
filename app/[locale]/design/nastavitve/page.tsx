'use client';

/**
 * ZAČASNA predogledna stran za redizajn nastavitev.
 *
 * Kaže iste gradnike, kot jih uporabljajo prave strani nastavitev, samo z
 * izmišljenim stanjem — da je videz mogoče preveriti brez prijave in baze.
 * Ko je redizajn potrjen, se mapa `design` zbriše.
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  Buildings,
  Gear,
  UsersThree,
  ChatTeardrop,
  Package,
  Stack,
  ClockCounterClockwise,
  CaretRight,
  Copy,
} from '@phosphor-icons/react';
import {
  SettingsSection,
  SettingRow,
  Switch,
  SegmentedControl,
  Input,
  Select,
  Textarea,
  TimePicker,
} from '@/components/settings';

const HUB = [
  { icon: Buildings, label: 'Podjetje', description: 'Naziv, naslov, davčna številka in delovni čas' },
  { icon: Gear, label: 'Splošno', description: 'Račun, jezik, obvestila in koda podjetja' },
  { icon: UsersThree, label: 'Člani', description: 'Kdo ima dostop in kaj sme početi' },
  { icon: Package, label: 'Paketi', description: 'Naročnina, plačila in računi' },
  { icon: ChatTeardrop, label: 'Sporočila', description: 'Predloge za e-pošto in SMS' },
  { icon: Stack, label: 'Dodatki', description: 'Razširitve, ki jih lahko vklopiš' },
  { icon: ClockCounterClockwise, label: 'Zgodovina', description: 'Kaj se je spreminjalo in kdaj' },
];

export default function SettingsDesignPreview() {
  const [reminders, setReminders] = useState(true);
  const [marketing, setMarketing] = useState(false);
  const [booking, setBooking] = useState(true);
  const [lang, setLang] = useState('sl');
  const [region, setRegion] = useState('SI');
  const [view, setView] = useState('teden');
  const [openTime, setOpenTime] = useState('08:00');
  const [name, setName] = useState('Salon Jedro');
  const [tax, setTax] = useState('');
  const [note, setNote] = useState('');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Nastavitve</h1>
        <p className="mt-0.5 text-base text-gray-500">Uredi podjetje, ekipo in obvestila.</p>
      </div>

      {/* Seznam razdelkov */}
      <div className="mb-9 overflow-hidden rounded-xl border border-gray-100 bg-white">
        {HUB.map((item, index) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href="#"
              className="group relative flex min-h-[44px] items-center gap-3.5 px-4 py-3 transition-colors hover:bg-gray-50 active:bg-gray-100"
            >
              <Icon
                weight="regular"
                className="h-[18px] w-[18px] flex-shrink-0 text-gray-400 transition-colors duration-150 group-hover:text-gray-600"
              />
              <div className="min-w-0 flex-1">
                <p className="text-base font-medium text-gray-900">{item.label}</p>
                <p className="mt-0.5 text-sm text-gray-500">{item.description}</p>
              </div>
              <CaretRight
                weight="bold"
                className="h-3.5 w-3.5 flex-shrink-0 text-gray-300 transition-colors duration-150 group-hover:text-gray-400"
              />
              {index !== HUB.length - 1 && (
                <span aria-hidden="true" className="absolute bottom-0 left-[3.25rem] right-0 h-px bg-gray-100" />
              )}
            </Link>
          );
        })}
      </div>

      {/* Stikala */}
      <SettingsSection
        title="Obvestila"
        description="Kdaj naj ti pišemo."
        footnote="Transakcijskih sporočil, kot so potrditve terminov, ni mogoče izklopiti."
      >
        <SettingRow label="Opomniki na termin" description="E-pošta dan prej">
          <Switch checked={reminders} onChange={setReminders} />
        </SettingRow>
        <SettingRow label="Nove rezervacije" description="Takoj ko nekdo rezervira">
          <Switch checked={booking} onChange={setBooking} variant="brand" />
        </SettingRow>
        <SettingRow label="Novice in nasveti" description="Največ enkrat mesečno">
          <Switch checked={marketing} onChange={setMarketing} />
        </SettingRow>
      </SettingsSection>

      {/* Polja */}
      <SettingsSection title="Podjetje" description="Podatki, ki jih vidijo stranke.">
        <SettingRow label="Naziv podjetja">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </SettingRow>
        <SettingRow label="Davčna številka" description="Brez predpone SI">
          <Input value={tax} onChange={(e) => setTax(e.target.value)} placeholder="12345678" prefix="SI" />
        </SettingRow>
        <SettingRow label="Jezik">
          <Select
            value={lang}
            onChange={setLang}
            options={[
              { value: 'sl', label: 'Slovenščina' },
              { value: 'en', label: 'English' },
            ]}
          />
        </SettingRow>
        <SettingRow label="Regija">
          <Select
            value={region}
            onChange={setRegion}
            options={[
              { value: 'SI', label: 'Slovenija' },
              { value: 'AT', label: 'Avstrija' },
            ]}
          />
        </SettingRow>
        <SettingRow label="Odprtje">
          <TimePicker value={openTime} onChange={setOpenTime} />
        </SettingRow>
        <SettingRow label="Opomba za stranke" fullWidth>
          <Textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Kratko sporočilo, ki se pokaže ob rezervaciji…"
          />
        </SettingRow>
      </SettingsSection>

      {/* Segmentirani preklopnik */}
      <SettingsSection title="Koledar" description="Kako se odpre ob zagonu.">
        <SettingRow label="Privzeti pogled">
          <SegmentedControl
              value={view}
              onChange={setView}
              options={[
                { value: 'dan', label: 'Dan' },
                { value: 'teden', label: 'Teden' },
                { value: 'mesec', label: 'Mesec' },
              ]}
            />
        </SettingRow>
      </SettingsSection>

      {/* Vrstice brez SettingRow — preverja, ali skupina pravilno loči poljubne otroke */}
      <SettingsSection
        title="Koda podjetja"
        description="Z njo se ekipa pridruži."
        footnote="Kode ne deli javno — vsak, ki jo ima, se lahko pridruži podjetju."
      >
        <>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="mb-1 text-sm text-gray-500">ID podjetja</p>
              <div className="gradient-text text-2xl font-bold tracking-tight">JEDRO-4821</div>
            </div>
            <button
              type="button"
              className="rounded-lg border border-gray-200 p-2 transition-colors hover:bg-gray-50"
            >
              <Copy className="h-4 w-4 text-gray-500" />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="mb-0.5 text-sm font-semibold text-gray-900">Koda za zaposlene</p>
              <p className="mb-2 text-sm text-gray-500">Dostop do koledarja in svojih terminov</p>
              <div className="gradient-text text-2xl font-bold tracking-tight">ZAP-7731</div>
            </div>
            <button
              type="button"
              className="rounded-lg border border-gray-200 p-2 transition-colors hover:bg-gray-50"
            >
              <Copy className="h-4 w-4 text-gray-500" />
            </button>
          </div>
        </>
      </SettingsSection>
    </div>
  );
}
