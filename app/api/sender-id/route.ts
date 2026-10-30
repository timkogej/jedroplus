// app/api/sender-id/route.ts
//
// Lastno ime pošiljatelja SMS (sender ID) kot mesečni dodatek za paket Pro.
//
//   GET            — stanje podjetja (paket, dodatek, status imena)
//   GET    ?ime=…  — ali je ime veljavno in prosto (brez zapisovanja)
//   POST   {ime}   — kupi dodatek (če še ni kupljen) in odda zahtevo za ime
//   DELETE         — prekliče dodatek
//
// Odobritev pri BulkGate ni takojšnja in traja dneve, zato tu ne nastavljamo
// imena v uporabo — samo zabeležimo zahtevo. Dokler ni odobrena, se pošilja
// naprej z Jedroplus; za to poskrbi `jp_sender_id`, ki jo kliče `sms-send`.
//
// Ime se hrani na `companies`, ne na "Podatki podjetij", zato ta pot obstaja
// posebej in ne gre skozi običajno shranjevanje nastavitev.

import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { rateLimit } from '@/lib/rateLimit';
import { authenticateRequest, resolveUserCompany } from '@/lib/auth/apiAuth';
import { stripe } from '@/lib/receptionistPlusStripe';

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


/** Imena, ki bi stranke zavedla ali jih že uporabljamo mi. */
const REZERVIRANA = ['jedroplus', 'jedro', 'jedro plus', 'info', 'sms', 'admin', 'stripe', 'bulkgate'];

type Kontekst = {
  uuid: string;
  textId: string;
  userId: string;
  email: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, 'public', any>;
};

/** Skupni uvod: omejitev klicev, prijava, podjetje in vloga lastnika/administratorja. */
async function pripravi(request: NextRequest): Promise<Kontekst | NextResponse> {
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

  return { uuid, textId, userId: auth.user.id, email: auth.user.email ?? '', admin };
}

/**
 * Obvestilo ekipi: ime je treba ročno registrirati pri BulkGate. Gre po isti poti
 * kot povpraševanja za Enterprise (n8n pošlje e-pošto na info@), zato ne potrebuje
 * novega poteka. Ne čaka in ne sme zrušiti zahteve.
 */
function obvestiTim(sporocilo: string, kontekst: Kontekst): void {
  const url = 'https://n8n.jedroplus.com/webhook/enterprise-inquiry';
  void fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.N8N_WEBHOOK_API_KEY ? { 'X-API-Key': process.env.N8N_WEBHOOK_API_KEY } : {}),
    },
    body: JSON.stringify({
      to: process.env.ENTERPRISE_INQUIRY_EMAIL ?? 'info@jedroplus.com',
      name: `Sender ID · ${kontekst.textId}`,
      email: kontekst.email || 'info@jedroplus.com',
      phone: null,
      message: sporocilo,
      company_id: kontekst.textId,
      receivedAt: new Date().toISOString(),
    }),
  }).catch((e) => console.warn('[sender-id] obvestilo ekipi ni uspelo:', e));
}

type Stanje = {
  dovoljen: boolean;
  ime: string | null;
  status: string | null;
  opomba: string | null;
  v_uporabi: string | null;
  moze_kupiti: boolean;
  dodatek: boolean;
};

/** Veljavnost, rezervirana imena in prostost med podjetji. Vrne razlog ali null. */
async function preveriIme(ime: string, kontekst: Kontekst): Promise<{ koda: string; razlog: string } | null> {
  if (!imeJeVeljavno(ime)) {
    return {
      koda: 'neveljavno_ime',
      razlog: 'Ime pošiljatelja sme imeti največ 11 znakov, brez šumnikov, in ne sme biti samo številka.',
    };
  }
  if (REZERVIRANA.includes(ime.trim().toLowerCase())) {
    return { koda: 'zasedeno', razlog: 'To ime je rezervirano. Izberite drugo.' };
  }
  const { data: prosto, error } = await kontekst.admin.rpc('jp_sender_id_prosto', {
    ime,
    company_code: kontekst.textId,
  });
  if (error) {
    return { koda: 'napaka', razlog: 'Razpoložljivosti imena ni bilo mogoče preveriti.' };
  }
  if (prosto === false) {
    return { koda: 'zasedeno', razlog: 'To ime že uporablja drugo podjetje. Izberite drugo.' };
  }
  return null;
}

async function preberiStanje(kontekst: Kontekst): Promise<Stanje | null> {
  const { data, error } = await kontekst.admin
    .rpc('jp_sender_id_stanje', { company_code: kontekst.textId })
    .maybeSingle<Stanje>();
  if (error) return null;
  return data ?? null;
}

export async function GET(request: NextRequest) {
  const kontekst = await pripravi(request);
  if (kontekst instanceof NextResponse) return kontekst;

  // Brez parametra `ime` vrnemo stanje podjetja (za prikaz na strani Dodatki).
  if (!request.nextUrl.searchParams.has('ime')) {
    const stanje = await preberiStanje(kontekst);
    if (!stanje) {
      return NextResponse.json(
        { ok: false, koda: 'napaka', razlog: 'Stanja ni bilo mogoče preveriti.' },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, stanje });
  }

  const ime = String(request.nextUrl.searchParams.get('ime') ?? '').trim();
  const napaka = await preveriIme(ime, kontekst);
  if (napaka) {
    return NextResponse.json({ ok: false, prosto: false, ...napaka }, { status: napaka.koda === 'napaka' ? 500 : 200 });
  }
  return NextResponse.json({ ok: true, prosto: true, ime });
}

export async function POST(request: NextRequest) {
  const kontekst = await pripravi(request);
  if (kontekst instanceof NextResponse) return kontekst;
  const { uuid, textId, admin } = kontekst;

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

  const napaka = await preveriIme(ime, kontekst);
  if (napaka) {
    return NextResponse.json({ ok: false, ...napaka }, { status: napaka.koda === 'napaka' ? 500 : 400 });
  }

  // Ali paket to sploh dopušča — preverimo na strežniku, ne le v vmesniku.
  const stanje = await preberiStanje(kontekst);
  if (!stanje) {
    return NextResponse.json(
      { ok: false, koda: 'napaka', razlog: 'Stanja ni bilo mogoče preveriti.' },
      { status: 500 }
    );
  }

  if (!stanje.dovoljen && !stanje.moze_kupiti) {
    return NextResponse.json(
      { ok: false, koda: 'paket_ne_dovoli', razlog: 'Lastno ime pošiljatelja je na voljo pri paketu Jedro Pro.' },
      { status: 403 }
    );
  }

  let itemId: string | null = null;

  // Dodatek še ni plačan: dodamo postavko obstoječi Stripe naročnini.
  if (!stanje.dovoljen) {
    const priceId = process.env.STRIPE_SENDER_ID_PRICE_ID;
    if (!priceId) {
      return NextResponse.json(
        { ok: false, koda: 'ni_cene', razlog: 'Cena dodatka ni nastavljena. Kontaktirajte podporo.' },
        { status: 503 }
      );
    }

    const { data: sub } = await admin
      .from('company_subscriptions')
      .select('provider_subscription_id')
      .eq('company_id', uuid)
      .eq('status', 'active')
      .maybeSingle();

    if (!sub?.provider_subscription_id) {
      return NextResponse.json(
        { ok: false, koda: 'ni_narocnine', razlog: 'Aktivna naročnina prek Stripe ni najdena.' },
        { status: 400 }
      );
    }

    try {
      const item = await stripe.subscriptionItems.create({
        subscription: String(sub.provider_subscription_id),
        price: priceId,
        quantity: 1,
        proration_behavior: 'create_prorations',
      });
      itemId = item.id;
    } catch (e) {
      console.error('[sender-id] Stripe item create failed:', e);
      return NextResponse.json(
        { ok: false, koda: 'placilo', razlog: 'Dodatka ni bilo mogoče aktivirati. Plačilo ni bilo izvedeno.' },
        { status: 502 }
      );
    }
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
      ...(itemId ? { sms_sender_id_addon: true, sms_sender_id_addon_item_id: itemId } : {}),
    })
    .eq('id', uuid);

  if (updErr) {
    // Plačilo je že steklo, zato ne molčimo: zapis gre v dnevnik za ročni popravek.
    console.error('[sender-id] DB update failed after charge:', { uuid, itemId, updErr });
    return NextResponse.json(
      { ok: false, koda: 'napaka', razlog: 'Zahteve ni bilo mogoče shraniti. Kontaktirajte podporo.' },
      { status: 500 }
    );
  }

  obvestiTim(
    `Nova zahteva za ime pošiljatelja SMS: "${ime}" (država ${drzava}). Podjetje ${textId}. ` +
      `Registriraj ga pri BulkGate, nato v tabeli companies nastavi sms_sender_id_status na 'odobreno' ali 'zavrnjeno'.` +
      (itemId ? ' Dodatek je bil pravkar kupljen.' : ' Dodatek je že plačan (sprememba imena).'),
    kontekst
  );

  return NextResponse.json({
    ok: true,
    status: 'v_obdelavi',
    ime,
    drzava,
    razlog: 'Zahteva je oddana. Do odobritve se sporočila pošiljajo z imenom Jedroplus.',
  });
}

/** Prekliče dodatek. Neporabljeni del meseca Stripe obračuna kot dobropis. */
export async function DELETE(request: NextRequest) {
  const kontekst = await pripravi(request);
  if (kontekst instanceof NextResponse) return kontekst;
  const { uuid, admin } = kontekst;

  const { data: co } = await admin
    .from('companies')
    .select('sms_sender_id_addon, sms_sender_id_addon_item_id')
    .eq('id', uuid)
    .maybeSingle();

  if (!co?.sms_sender_id_addon) {
    return NextResponse.json({ ok: true });
  }

  if (co.sms_sender_id_addon_item_id) {
    try {
      await stripe.subscriptionItems.del(String(co.sms_sender_id_addon_item_id), {
        proration_behavior: 'create_prorations',
      });
    } catch (e) {
      console.error('[sender-id] Stripe item delete failed:', e);
      return NextResponse.json(
        { ok: false, koda: 'placilo', razlog: 'Dodatka ni bilo mogoče preklicati. Poskusite znova.' },
        { status: 502 }
      );
    }
  }

  // Ime ostane zapisano, a se ne uporablja (glej jp_sender_id).
  const { error } = await admin
    .from('companies')
    .update({ sms_sender_id_addon: false, sms_sender_id_addon_item_id: null })
    .eq('id', uuid);

  if (error) {
    console.error('[sender-id] DB update failed after cancel:', { uuid, error });
    return NextResponse.json(
      { ok: false, koda: 'napaka', razlog: 'Preklic je izveden, a stanja ni bilo mogoče shraniti.' },
      { status: 500 }
    );
  }

  obvestiTim(
    `Preklic dodatka za ime pošiljatelja SMS. Podjetje ${kontekst.textId}. Ime ni več v uporabi; po potrebi ga odjavi pri BulkGate.`,
    kontekst
  );

  return NextResponse.json({ ok: true });
}
