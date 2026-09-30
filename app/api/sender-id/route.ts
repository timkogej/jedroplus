// app/api/sender-id/route.ts
//
// Oddaja zahteve za lastno ime pošiljatelja SMS (sender ID).
//
// Odobritev pri BulkGate ni takojšnja in traja dneve, zato tu ne nastavljamo
// imena v uporabo — samo zabeležimo zahtevo. Dokler ni odobrena, se pošilja
// naprej z Jedroplus; za to poskrbi `jp_sender_id`, ki jo kliče `sms-send`.
//
// Ime se hrani na `companies`, ne na "Podatki podjetij", zato ta pot obstaja
// posebej in ne gre skozi običajno shranjevanje nastavitev.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '@/lib/rateLimit';
import { authenticateRequest, resolveUserCompany } from '@/lib/auth/apiAuth';

/** BulkGate: največ 11 znakov, brez šumnikov, ne sama številka. */
function imeJeVeljavno(ime: string): boolean {
  const t = ime.trim();
  return (
    t !== '' &&
    t.length <= 11 &&
    /^[A-Za-z0-9 ]+$/.test(t) &&
    !/^[0-9 ]+$/.test(t)
  );
}

export async function POST(request: NextRequest) {
  const { success, reset } = await rateLimit(request, 'auth');
  if (!success) {
    return NextResponse.json(
      {
        ok: false,
        koda: 'prevec_zahtev',
        razlog: 'Preveč zahtev. Počakajte trenutek.',
        retryAfter: Math.ceil((reset - Date.now()) / 1000),
      },
      { status: 429 }
    );
  }

  const auth = await authenticateRequest(request);
  if ('response' in auth) return auth.response;

  const { uuid, textId } = await resolveUserCompany(auth.user.id);
  if (!uuid || !textId) {
    return NextResponse.json(
      { ok: false, koda: 'ni_podjetja', razlog: 'Vaš račun ni povezan s podjetjem.' },
      { status: 403 }
    );
  }

  let ime = '';
  try {
    const body = (await request.json()) as { ime?: unknown };
    ime = String(body?.ime ?? '').trim();
  } catch {
    return NextResponse.json(
      { ok: false, koda: 'neveljavna_zahteva', razlog: 'Zahteve ni bilo mogoče prebrati.' },
      { status: 400 }
    );
  }

  if (!imeJeVeljavno(ime)) {
    return NextResponse.json(
      {
        ok: false,
        koda: 'neveljavno_ime',
        razlog:
          'Ime pošiljatelja sme imeti največ 11 znakov, brez šumnikov, in ne sme biti samo številka.',
      },
      { status: 400 }
    );
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Ime pošiljatelja vidi vsaka stranka podjetja, zato ga ne sme spreminjati osebje.
  const { data: member } = await admin
    .from('company_members')
    .select('role')
    .eq('user_id', auth.user.id)
    .eq('company_id', uuid)
    .maybeSingle();

  const role = String(member?.role ?? '').toLowerCase();
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json(
      { ok: false, koda: 'ni_pravic', razlog: 'To lahko spremeni le lastnik ali administrator.' },
      { status: 403 }
    );
  }

  // Ali paket to sploh dopušča — preverimo na strežniku, ne le v vmesniku.
  const { data: stanje, error: stanjeErr } = await admin
    .rpc('jp_sender_id_stanje', { company_code: textId })
    .maybeSingle<{ dovoljen: boolean }>();

  if (stanjeErr) {
    return NextResponse.json(
      { ok: false, koda: 'napaka', razlog: 'Stanja ni bilo mogoče preveriti.' },
      { status: 500 }
    );
  }

  if (!stanje?.dovoljen) {
    return NextResponse.json(
      {
        ok: false,
        koda: 'paket_ne_dovoli',
        razlog: 'Lastno ime pošiljatelja je na voljo pri paketu Jedro Premium.',
      },
      { status: 403 }
    );
  }

  // Država ob zahtevi — odobritev pri operaterju velja za državo, ne globalno.
  const { data: pp } = await admin
    .from('Podatki podjetij')
    .select('country_code')
    .eq('ID Podjetja', textId)
    .maybeSingle();

  const drzava = String(pp?.country_code ?? 'SI').toUpperCase();

  const { error: updErr } = await admin
    .from('companies')
    .update({
      sms_sender_id: ime,
      sms_sender_id_status: 'v_obdelavi',
      sms_sender_id_country: drzava,
      sms_sender_id_note: null,
      sms_sender_id_requested_at: new Date().toISOString(),
      sms_sender_id_decided_at: null,
    })
    .eq('id', uuid);

  if (updErr) {
    return NextResponse.json(
      { ok: false, koda: 'napaka', razlog: 'Zahteve ni bilo mogoče shraniti.' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    status: 'v_obdelavi',
    ime,
    drzava,
    razlog:
      'Zahteva je oddana. Do odobritve se sporočila pošiljajo z imenom Jedroplus.',
  });
}
