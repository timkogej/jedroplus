'use client';

/**
 * ZAČASNA predogledna stran za redizajn ReceptionistPlus.
 *
 * Uporablja prave zavihke; klici na /api/receptionistplus/* so tu zamenjani z
 * izmišljenimi podatki (nakup kreditov ne naredi ničesar). Ko je redizajn
 * potrjen, se mapa `design` zbriše.
 */

import { useState } from 'react';
import { SegmentedControl } from '@/components/settings/SegmentedControl';
import {
  TABS,
  type TabKey,
  type ReceptionistCall,
  type CreditTransaction,
  NastavitveTab,
  DnevnikTab,
  KreditiTab,
  NotActivated,
} from '@/components/receptionist-plus/ReceptionistPlusTabs';

function ago(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

const say = (role: 'assistant' | 'user', text: string) => ({ role, text, ts: ago(0) });

const CALLS: ReceptionistCall[] = [
  {
    id: 'c1', started_at: ago(35), ended_at: ago(32), duration_sec: 184, billed_credits: 3.07, outcome: 'booked',
    created_termin_id: '8f3a2c1e-77b0-4c11-9a0d-2b5e4c9f1a00',
    transcript: [
      say('assistant', 'Pozdravljeni, dobrodošli v Salonu Maja! Kako vam lahko pomagam?'),
      say('user', 'Rada bi se naročila na striženje, po možnosti v četrtek popoldne.'),
      say('assistant', 'V četrtek imamo prosto ob 15:00 ali 16:30. Kateri termin vam ustreza?'),
      say('user', 'Ob 15:00, prosim.'),
      say('assistant', 'Odlično, termin za žensko striženje v četrtek ob 15:00 je rezerviran. Potrditev prejmete po SMS.'),
    ],
  },
  {
    id: 'c2', started_at: ago(160), ended_at: ago(159), duration_sec: 72, billed_credits: 1.2, outcome: 'info_only', created_termin_id: null,
    transcript: [
      say('assistant', 'Pozdravljeni, dobrodošli! Kako vam lahko pomagam?'),
      say('user', 'Do kdaj imate odprto v soboto?'),
      say('assistant', 'V soboto smo odprti od 8:00 do 13:00.'),
    ],
  },
  {
    id: 'c3', started_at: ago(60 * 26), ended_at: ago(60 * 26 - 2), duration_sec: 131, billed_credits: 2.18, outcome: 'message_taken', created_termin_id: null,
    transcript: [
      say('assistant', 'Pozdravljeni, dobrodošli! Kako vam lahko pomagam?'),
      say('user', 'Prosim, da me Maja pokliče glede barvanja.'),
      say('assistant', 'Seveda, sporočilo sem zabeležila. Maja vas bo poklicala še danes.'),
    ],
  },
  { id: 'c4', started_at: ago(60 * 30), ended_at: ago(60 * 30), duration_sec: 9, billed_credits: 0.15, outcome: 'abandoned', created_termin_id: null, transcript: [] },
  { id: 'c5', started_at: ago(60 * 75), ended_at: null, duration_sec: 0, billed_credits: 0, outcome: 'no_credits', created_termin_id: null, transcript: null },
];

const TRANSACTIONS: CreditTransaction[] = [
  { id: 't1', delta_credits: -3.07, balance_after: 182.5, type: 'deduction', note: null, created_at: ago(32) },
  { id: 't2', delta_credits: -1.2, balance_after: 185.57, type: 'deduction', note: null, created_at: ago(159) },
  { id: 't3', delta_credits: 100, balance_after: 186.77, type: 'purchase', note: null, created_at: ago(60 * 48) },
  { id: 't4', delta_credits: 5, balance_after: 86.77, type: 'adjustment', note: null, created_at: ago(60 * 24 * 6) },
  { id: 't5', delta_credits: 30, balance_after: 30, type: 'trial_grant', note: null, created_at: ago(60 * 24 * 30) },
];

// Lažni API — samo za to predogledno stran.
if (typeof window !== 'undefined' && !(window as unknown as { __rpMock?: boolean }).__rpMock) {
  (window as unknown as { __rpMock?: boolean }).__rpMock = true;
  const realFetch = window.fetch.bind(window);
  const json = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } }));
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/api/receptionistplus/calls')) {
      const page = Number(new URL(url, location.origin).searchParams.get('page') ?? 0);
      return json({ ok: true, calls: page === 0 ? CALLS : CALLS.slice(0, 2), totalCount: 27 });
    }
    if (url.includes('/api/receptionistplus/credits')) return json({ ok: true, balance: 182.5, transactions: TRANSACTIONS });
    if (url.includes('/api/receptionistplus/settings')) return json({ ok: true });
    if (url.includes('/api/receptionistplus/')) return json({ ok: false, error: 'predogled' });
    return realFetch(input, init);
  };
}

const SETTINGS = {
  enabled: true,
  low_balance_threshold: 20,
  greeting_text: 'Pozdravljeni, dobrodošli v Salonu Maja! Kako vam lahko pomagam?',
  language: 'sl',
};

export default function ReceptionistPreview() {
  const [state, setState] = useState<'active' | 'inactive'>('active');
  const [tab, setTab] = useState<TabKey>('nastavitve');

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
            predogled
          </span>
          <button type="button" onClick={() => setState(state === 'active' ? 'inactive' : 'active')} className="text-[12px] font-medium text-gray-500 underline-offset-2 hover:underline">
            {state === 'active' ? 'Pokaži »ni aktiviran«' : 'Pokaži aktiviran'}
          </button>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">ReceptionistPlus</h1>
          <p className="mt-0.5 text-base text-gray-500">Vaša AI telefonska asistentka</p>
        </div>

        {state === 'inactive' ? (
          <NotActivated onActivated={() => setState('active')} />
        ) : (
          <>
            <div className="mb-6">
              <SegmentedControl
                options={TABS.map(({ key, label }) => ({ value: key, label }))}
                value={tab}
                onChange={(value) => setTab(value as TabKey)}
              />
            </div>
            {tab === 'nastavitve' && <NastavitveTab settings={SETTINGS} onSave={async () => {}} />}
            {tab === 'dnevnik' && <DnevnikTab />}
            {tab === 'krediti' && <KreditiTab />}
          </>
        )}
      </div>
    </main>
  );
}
