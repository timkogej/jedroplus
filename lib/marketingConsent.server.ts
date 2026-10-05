// lib/marketingConsent.server.ts
//
// Unsubscribe page and endpoint: read the client, record the opt-out.
// Service role — server only.

import { createClient } from '@supabase/supabase-js';
import { normalizeCommunicationLanguage, toIsoLanguage, type IsoLanguageCode } from './communicationLanguage';

const COMPANY_COLUMNS = ['ID podjetja', 'ID Podjetja', 'ID_podjetja', 'company_id'];

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export interface UnsubscribeTarget {
  clientId: string;
  companyName: string;
  language: IsoLanguageCode;
  alreadyOut: boolean;
}

/** The client behind a verified token, with what the unsubscribe page shows. */
export async function loadUnsubscribeTarget(clientId: string): Promise<UnsubscribeTarget | null> {
  const admin = adminClient();
  const { data: client } = await admin.from('Stranke').select('*').eq('id', clientId).maybeSingle();
  if (!client) return null;
  const row = client as Record<string, unknown>;

  let companyName = '';
  const companyId = COMPANY_COLUMNS.map((c) => row[c]).find((v) => typeof v === 'string' && v);
  if (companyId) {
    const { data: company } = await admin
      .from('Podatki podjetij')
      .select('*')
      .eq('ID Podjetja', companyId as string)
      .maybeSingle();
    const c = (company ?? {}) as Record<string, unknown>;
    companyName = String(c['Naziv Podjetja'] ?? c['Ime podjetja'] ?? '').trim();
  }

  return {
    clientId,
    companyName,
    language: toIsoLanguage(normalizeCommunicationLanguage(row.language, 'slo')),
    alreadyOut: Boolean(row.marketing_opt_out_at),
  };
}

export async function recordOptOut(clientId: string): Promise<boolean> {
  const { error } = await adminClient()
    .from('Stranke')
    .update({ marketing_opt_out_at: new Date().toISOString() })
    .eq('id', clientId)
    .is('marketing_opt_out_at', null);
  if (error) console.error('[unsubscribe] saving opt-out failed:', error.message);
  return !error;
}
