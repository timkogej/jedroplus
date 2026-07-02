import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireCompanyAccess } from '@/lib/auth/apiAuth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getClient() {
  return createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const SERVICE_ID_COLS = ['id', 'ID storitev', 'ID storitve'];
const SERVICE_NAME_COLS = ['Naziv', 'naziv', 'Storitev', 'name'];
const SERVICE_PRICE_COLS = ['Cena', 'cena', 'price'];
const SERVICE_DURATION_COLS = ['Trajanje', 'trajanje', 'duration'];

async function fetchServiceDetails(supabase: ReturnType<typeof getClient>, storitev_id: string) {
  for (const col of SERVICE_ID_COLS) {
    const { data } = await supabase.from('Storitve').select('*').eq(col, storitev_id).limit(1);
    if (data && data.length > 0) {
      const svc = data[0] as Record<string, unknown>;
      const nameCol = SERVICE_NAME_COLS.find((c) => svc[c] !== undefined);
      const priceCol = SERVICE_PRICE_COLS.find((c) => svc[c] !== undefined);
      const durCol = SERVICE_DURATION_COLS.find((c) => svc[c] !== undefined);
      return {
        naziv: nameCol ? String(svc[nameCol] ?? '') : '',
        cena: priceCol ? Number(svc[priceCol] ?? 0) : 0,
        trajanje: durCol ? Number(svc[durCol] ?? 0) : 0,
      };
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const company_id = request.nextUrl.searchParams.get('company_id');
    if (!company_id) {
      return NextResponse.json({ ok: false, error: 'company_id required' }, { status: 400 });
    }

    const auth = await requireCompanyAccess(request, company_id);
    if ('response' in auth) return auth.response;

    const supabase = getClient();

    const { data: addOns, error } = await supabase
      .from('add_on_storitve')
      .select('*')
      .eq('company_id', company_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const result = await Promise.all(
      (addOns || []).map(async (ao) => {
        const svcDetails = await fetchServiceDetails(supabase, ao.storitev_id);
        const originalCena = svcDetails?.cena ?? 0;
        const final = ao.tip_popusta === 'percentage'
          ? Math.max(0, originalCena - (originalCena * ao.vrednost_popusta) / 100)
          : Math.max(0, originalCena - ao.vrednost_popusta);
        return {
          ...ao,
          naziv: svcDetails?.naziv ?? '',
          original_cena: originalCena,
          final_cena: final,
          trajanje: svcDetails?.trajanje ?? 0,
        };
      })
    );

    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { company_id, storitev_id, tip_popusta, vrednost_popusta, aktiven } = body;

    if (!company_id || !storitev_id) {
      return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 });
    }

    const auth = await requireCompanyAccess(request, company_id);
    if ('response' in auth) return auth.response;

    const supabase = getClient();

    const { data: addOn, error } = await supabase
      .from('add_on_storitve')
      .insert({ company_id, storitev_id, tip_popusta, vrednost_popusta, aktiven: aktiven ?? true })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, data: addOn });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
