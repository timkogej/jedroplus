'use client';

/**
 * ZAČASNA predogledna stran za redizajn Lost Leads.
 * Ko je redizajn potrjen, se mapa `design` zbriše.
 */

import { motion } from 'motion/react';
import {
  TrendDown,
  Gear,
  Users,
  PaperPlaneRight,
  EnvelopeSimple,
  Phone,
  ChatText,
  CalendarX,
  CheckCircle,
} from '@phosphor-icons/react';
import ClientInitialsBadge from '@/components/clients/ClientInitialsBadge';
import { MetricGroup } from '@/components/dashboard';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { SectionPanel, SettingRow, StatusPill, ValuePill } from '@/components/ui/OverviewPrimitives';

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  days: number;
  notified: boolean;
}

const NAMES = [
  'Ana Kovač', 'Marko Zupan', 'Luka Horvat', 'Nina Bizjak', 'Tomaž Krajnc',
  'Jure Potočnik', 'Eva Zajc', 'Rok Mlakar', 'Blaž Kralj', 'Nejc Vidic',
  'Urša Jereb', 'Katja Bevk', 'Sara Lah', 'Miha Oblak', 'Petra Golob',
  'Anže Rus', 'Maja Turk', 'Gregor Pavlin', 'Tina Kos', 'Domen Sever',
  'Lara Bogataj', 'Jan Ferjan', 'Nika Cerar', 'Vid Kalan',
];

const LEADS: Lead[] = NAMES.map((name, i) => {
  const [first, last] = name.split(' ');
  return {
    id: String(i + 1),
    name,
    email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
    phone: `041 ${200 + i} ${300 + i}`,
    days: 31 + i * 9,
    notified: i % 3 === 0,
  };
});

export default function LostLeadsDesignPreview() {
  const columns: DataTableColumn<Lead>[] = [
    {
      id: 'client',
      header: 'Stranka',
      sortValue: (c) => c.name.toLowerCase(),
      cell: (c) => (
        <div className="flex items-center gap-3">
          <ClientInitialsBadge
            firstName={c.name.split(' ')[0]}
            lastName={c.name.split(' ')[1]}
            size="sm"
            gradient="violet-cyan"
            variant="text"
          />
          <span className="text-sm font-medium text-gray-900">{c.name}</span>
        </div>
      ),
    },
    {
      id: 'email',
      header: 'Email',
      sortValue: (c) => c.email,
      cell: (c) => (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <EnvelopeSimple className="h-4 w-4 flex-shrink-0 text-gray-400" weight="regular" />
          <span className="truncate">{c.email}</span>
        </div>
      ),
    },
    {
      id: 'phone',
      header: 'Telefon',
      cell: (c) => (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Phone className="h-4 w-4 flex-shrink-0 text-gray-400" weight="regular" />
          <span className="tnum whitespace-nowrap">{c.phone}</span>
        </div>
      ),
    },
    {
      id: 'daysInactive',
      header: 'Dni neaktivna',
      sortValue: (c) => c.days,
      cell: (c) => (
        <span className="tnum whitespace-nowrap text-sm text-amber-600">{c.days} dni</span>
      ),
    },
    {
      id: 'notified',
      header: 'Obveščena',
      sortValue: (c) => (c.notified ? 1 : 0),
      cell: (c) =>
        c.notified ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            <CheckCircle className="h-3.5 w-3.5" weight="regular" />
            Da
          </span>
        ) : (
          <span className="text-sm text-gray-400">Ne</span>
        ),
    },
  ];

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
            <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">Lost Leads</h1>
            <p className="mt-0.5 text-base text-gray-500">
              Stranke, ki že dolgo niso bile pri vas.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 active:bg-gray-100"
          >
            <Gear size={17} weight="regular" className="text-gray-500" />
            Nastavitve
          </button>
        </motion.div>

        <div className="mb-8">
          <MetricGroup
            metrics={[
              { label: 'Neaktivne stranke', value: LEADS.length, caption: 'Skupaj označenih', icon: TrendDown },
              { label: 'Obveščene stranke', value: 8, caption: 'Ta mesec', icon: PaperPlaneRight },
              { label: 'Dnevi neaktivnosti', value: 30, caption: 'Prag neaktivnosti', icon: CalendarX },
            ]}
          />
        </div>

        <section className="mb-8">
          <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wider text-gray-500">
            Neaktivne stranke
          </h2>
          <p className="mb-2 px-1 text-[13px] text-gray-500">
            {LEADS.length} strank ni bilo pri vas že več kot 30 dni.
          </p>
          <DataTable<Lead>
            rows={LEADS}
            columns={columns}
            rowKey={(c) => c.id}
            pageSize={20}
            defaultSort={{ columnId: 'daysInactive', direction: 'desc' }}
            mobile={{
              leading: (c) => (
                <ClientInitialsBadge
                  firstName={c.name.split(' ')[0]}
                  lastName={c.name.split(' ')[1]}
                  size="md"
                  gradient="violet-cyan"
                  variant="text"
                />
              ),
              title: (c) => c.name,
              subtitle: (c) => c.email,
              meta: (c) => (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="tnum text-[13px] text-amber-600">{c.days} dni</span>
                  {c.notified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      <CheckCircle className="h-3 w-3" weight="regular" />
                      Da
                    </span>
                  )}
                </div>
              ),
            }}
          />
        </section>

        <section className="mb-8">
          <SectionPanel title="Nastavitve">
            <SettingRow
              icon={<TrendDown size={16} weight="regular" />}
              label="Status"
              description="Ali samodejno obveščanje neaktivnih strank teče."
              value={<StatusPill enabled label="Omogočeno" />}
            />
            <SettingRow
              icon={<CalendarX size={16} weight="regular" />}
              label="Prag neaktivnosti"
              description="Po koliko dneh brez obiska velja stranka za neaktivno."
              value={<ValuePill>30 dni</ValuePill>}
            />
            <SettingRow
              icon={<ChatText size={16} weight="regular" />}
              label="Ton komunikacije"
              description="Kako sporočilo zveni — bolj sproščeno ali bolj uradno."
              value={<ValuePill>Prijazen</ValuePill>}
            />
            <SettingRow
              icon={<Users size={16} weight="regular" />}
              label="Popust za vrnitev"
              description="Ponudba, s katero stranko povabimo nazaj."
              value={<span className="text-sm text-gray-900">15 % na naslednji obisk</span>}
            />
            <SettingRow
              icon={<EnvelopeSimple size={16} weight="regular" />}
              label="Navodila AI-ju"
              description="Kaj naj Asistent+ upošteva pri pisanju sporočila."
              value={
                <p className="max-w-xs whitespace-pre-wrap text-left text-sm text-gray-900 sm:text-right">
                  Omeni zadnjo storitev in povabi nazaj brez pritiska.
                </p>
              }
            />
          </SectionPanel>
        </section>

        <SectionPanel title="Kako deluje">
          <div className="p-4">
            <p className="whitespace-pre-wrap text-sm leading-7 text-gray-600">
              Ko stranka določeno število dni ne pride,{' '}
              <span className="font-semibold text-gray-900">jo sistem samodejno povabi nazaj</span>.
              Sporočilo sestavi Asistent+ po vaših navodilih in tonu.
            </p>
          </div>
        </SectionPanel>
      </div>
    </main>
  );
}
