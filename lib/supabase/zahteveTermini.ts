// lib/supabase/zahteveTermini.ts
//
// Read access for the "zahteve_termini" table (request-based booking requests,
// booking_mode='request') — mirrors the fetchServices/fetchEmployees pattern in
// lib/supabase/appointments.ts: company-scoped read via fetchTableRows
// (supabaseReadOnly under the hood), never a direct write from the browser.

import { fetchTableRows } from '@/lib/companyScope';
import { supabaseReadOnly } from '@/src/lib/supabaseReadOnly';

export type ZahtevaTerminaStatus = 'v_pregledu' | 'potrjeno' | 'zavrnjeno';
export type ZeljeniDelDneva = 'dopoldan' | 'popoldan' | 'vseeno';

export interface ZahtevaTermina {
  id: string;
  ime: string;
  priimek: string;
  email: string;
  telefon: string;
  opis_zelje: string;
  spol?: string | null;
  zeljeni_datum_od: string;
  zeljeni_datum_do: string;
  zeljeni_del_dneva: ZeljeniDelDneva;
  status: ZahtevaTerminaStatus;
  zavrnitev_razlog?: string | null;
  confirmed_termin_id?: string | null;
  language?: string | null;
  created_at: string;
  updated_at: string;
}

function parseZahteva(row: Record<string, unknown>): ZahtevaTermina | null {
  const id = row.id;
  if (!id) return null;

  return {
    id: String(id),
    ime: String(row.ime ?? ''),
    priimek: String(row.priimek ?? ''),
    email: String(row.email ?? ''),
    telefon: String(row.telefon ?? ''),
    opis_zelje: String(row.opis_zelje ?? ''),
    spol: row.spol != null ? String(row.spol) : null,
    zeljeni_datum_od: String(row.zeljeni_datum_od ?? ''),
    zeljeni_datum_do: String(row.zeljeni_datum_do ?? ''),
    zeljeni_del_dneva: (row.zeljeni_del_dneva as ZeljeniDelDneva) ?? 'vseeno',
    status: (row.status as ZahtevaTerminaStatus) ?? 'v_pregledu',
    zavrnitev_razlog: row.zavrnitev_razlog != null ? String(row.zavrnitev_razlog) : null,
    confirmed_termin_id: row.confirmed_termin_id != null ? String(row.confirmed_termin_id) : null,
    language: row.language != null ? String(row.language) : null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
}

export async function fetchZahteveTermini(companyId: string): Promise<{
  data: ZahtevaTermina[] | null;
  error: Error | null;
}> {
  try {
    const result = await fetchTableRows<Record<string, unknown>>('zahteve_termini', companyId, 500);

    if (result.error) {
      throw new Error(result.error);
    }

    const zahteve: ZahtevaTermina[] = [];
    for (const row of result.data ?? []) {
      const zahteva = parseZahteva(row);
      if (zahteva) zahteve.push(zahteva);
    }

    // Newest first
    zahteve.sort((a, b) => b.created_at.localeCompare(a.created_at));

    return { data: zahteve, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch zahteve_termini'),
    };
  }
}

// The n8n booking-v2 actions (request-slots / request-confirm) key off the
// company's slug, not the short "ID podjetja" code used elsewhere in this app.
// Same lookup as app/[locale]/qr-koda/page.tsx and nastavitve/splosno/page.tsx.
export async function fetchCompanySlug(companyId: string): Promise<string | null> {
  if (!companyId || companyId.trim() === '') return null;
  const { data } = await supabaseReadOnly
    .from('companies')
    .select('slug')
    .eq('company_id', companyId)
    .maybeSingle();
  return data?.slug ? String(data.slug) : null;
}
