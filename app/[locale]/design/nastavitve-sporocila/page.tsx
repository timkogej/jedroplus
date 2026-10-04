'use client';

/**
 * ZAČASNA predogledna stran za Nastavitve → Sporočila. Prava stran z
 * izmišljenim podjetjem (samo v tem drevesu) in izmišljenimi sporočili iz
 * »message_outbox«. Ko je redizajn potrjen, se mapa `design` zbriše.
 */

import { supabase } from '@/lib/supabaseClient';
import { CompanyContext, useCompany } from '@/app/company-context';
import SporocilaPage from '../../nastavitve/sporocila/page';

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 3600 * 1000).toISOString();
}

const MESSAGES = [
  { id: 'm1', entity_type: 'appointment_confirmation', channel: 'email', to: 'ana.kovac@example.com', status: 'sent', subject: 'Potrditev termina — Salon Maja', body: 'Pozdravljeni Ana,\n\nvaš termin za žensko striženje je potrjen za četrtek, 9. 10., ob 15:00.\n\nLep pozdrav,\nSalon Maja', sent_at: hoursAgo(1) },
  { id: 'm2', entity_type: 'appointment_reminder', channel: 'sms', to: '+386 41 234 567', status: 'sent', body: 'Salon Maja: opomnik na vaš termin jutri ob 10:00. Za odpoved odgovorite NE.', sent_at: hoursAgo(5) },
  { id: 'm3', entity_type: 'appointment_reminder', channel: 'sms', to: '+386 31 555 123', status: 'queued', body: 'Salon Maja: opomnik na vaš termin jutri ob 16:30.', sent_at: hoursAgo(6) },
  { id: 'm4', entity_type: 'appointment_post', channel: 'email', to: 'luka.zupan@example.com', status: 'sent', subject: 'Hvala za obisk!', body: 'Hvala, ker ste nas obiskali. Veseli bomo vaše ocene.', sent_at: hoursAgo(26) },
  { id: 'm5', entity_type: 'lost_leads', channel: 'email', to: 'eva.kranjc@example.com', status: 'failed', subject: 'Pogrešamo vas', body: 'Že dolgo vas nismo videli — ta mesec vam podarimo 10 % popusta.', sent_at: hoursAgo(50) },
  { id: 'm6', entity_type: 'communication_message', channel: 'sms', to: '+386 40 987 654', status: 'sent', body: '', sent_at: hoursAgo(74) },
];

type Patched = { __sporocilaPreview?: boolean };

if (typeof window !== 'undefined' && !(window as unknown as Patched).__sporocilaPreview) {
  (window as unknown as Patched).__sporocilaPreview = true;
  const realFrom = supabase.from.bind(supabase);
  (supabase as unknown as Record<string, unknown>).from = (table: string) => {
    if (table !== 'message_outbox') return realFrom(table);
    const result = { data: MESSAGES, error: null };
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'gte', 'lte', 'order', 'limit']) chain[m] = () => chain;
    chain.then = (resolve: (v: typeof result) => unknown) => Promise.resolve(result).then(resolve);
    return chain;
  };
}

export default function NastavitveSporocilaPreview() {
  const real = useCompany();
  return (
    <CompanyContext.Provider value={{ ...real, companyUuid: 'preview-uuid' }}>
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-2xl px-4 py-7 sm:px-6 sm:py-9">
          <div className="mb-3 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
            predogled
          </div>
          <SporocilaPage />
        </div>
      </div>
    </CompanyContext.Provider>
  );
}
