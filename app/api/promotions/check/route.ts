import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculateFinalPrice } from '@/lib/promotions';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getClient() {
  return createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const SERVICE_ID_COLS = ['id', 'ID storitev', 'ID storitve', 'ID_storitve'];
const PRICE_COLS = ['Cena', 'cena', 'price'];

async function getServicePrice(supabase: ReturnType<typeof getClient>, storitev_id: string): Promise<number> {
  for (const col of SERVICE_ID_COLS) {
    const { data } = await supabase.from('Storitve').select('*').eq(col, storitev_id).limit(1);
    if (data && data.length > 0) {
      const svc = data[0] as Record<string, unknown>;
      const priceCol = PRICE_COLS.find((c) => svc[c] !== undefined && svc[c] !== null && svc[c] !== '');
      if (priceCol) return Number(svc[priceCol] ?? 0);
      return 0;
    }
  }
  return 0;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      company_id: string;
      storitev_id: string;
      datum: string;
      cas: string;
    };

    const { company_id, storitev_id, datum, cas } = body;

    if (!company_id || !storitev_id || !datum || !cas) {
      return NextResponse.json({ ok: false, found: false, error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = getClient();

    const originalPrice = await getServicePrice(supabase, storitev_id);

    // 1 — Check discounts (priority over happy hours)
    const { data: discounts, error: dErr } = await supabase
      .from('popusti')
      .select('*')
      .eq('company_id', company_id)
      .eq('aktiven', true)
      .lte('datum_zacetek', datum)
      .gte('datum_konec', datum);

    if (dErr) throw dErr;

    let foundDiscount = null;
    for (const discount of discounts || []) {
      const { data: links } = await supabase
        .from('popusti_storitve')
        .select('storitev_id')
        .eq('popust_id', discount.id)
        .eq('storitev_id', storitev_id)
        .limit(1);

      if (links && links.length > 0) {
        foundDiscount = discount;
        break;
      }
    }

    if (foundDiscount) {
      const { finalPrice, discountAmount, popustTypeLabel } = calculateFinalPrice(
        originalPrice,
        foundDiscount.tip_popusta as 'percentage' | 'fixed',
        foundDiscount.vrednost
      );
      return NextResponse.json({
        found: true,
        type: 'popust',
        id: foundDiscount.id,
        naziv: foundDiscount.naziv,
        tip_popusta: foundDiscount.tip_popusta,
        vrednost: foundDiscount.vrednost,
        original_cena: originalPrice.toFixed(2),
        popust_vrednost: discountAmount.toFixed(2),
        final_cena: finalPrice.toFixed(2),
        popust_type_label: popustTypeLabel,
      });
    }

    // 2 — Check happy hours
    const dayOfWeek = new Date(datum).getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

    const { data: happyHours, error: hhErr } = await supabase
      .from('happy_hours')
      .select('*')
      .eq('company_id', company_id)
      .eq('aktiven', true)
      .contains('dnevi_v_tednu', [dayOfWeek])
      .lte('cas_zacetek', cas)
      .gte('cas_konec', cas);

    if (hhErr) throw hhErr;

    let foundHH = null;
    for (const hh of happyHours || []) {
      if (hh.vse_storitve) {
        foundHH = hh;
        break;
      }
      const { data: links } = await supabase
        .from('happy_hours_storitve')
        .select('storitev_id')
        .eq('happy_hour_id', hh.id)
        .eq('storitev_id', storitev_id)
        .limit(1);

      if (links && links.length > 0) {
        foundHH = hh;
        break;
      }
    }

    if (foundHH) {
      const { finalPrice, discountAmount, popustTypeLabel } = calculateFinalPrice(
        originalPrice,
        foundHH.tip_popusta as 'percentage' | 'fixed',
        foundHH.vrednost
      );
      return NextResponse.json({
        found: true,
        type: 'happy_hour',
        id: foundHH.id,
        naziv: foundHH.naziv || 'Happy Hour',
        tip_popusta: foundHH.tip_popusta,
        vrednost: foundHH.vrednost,
        original_cena: originalPrice.toFixed(2),
        popust_vrednost: discountAmount.toFixed(2),
        final_cena: finalPrice.toFixed(2),
        popust_type_label: popustTypeLabel,
      });
    }

    return NextResponse.json({
      found: false,
      type: null,
      id: null,
      naziv: null,
      tip_popusta: null,
      vrednost: null,
      original_cena: originalPrice.toFixed(2),
      popust_vrednost: '0.00',
      final_cena: originalPrice.toFixed(2),
      popust_type_label: null,
    });
  } catch (err) {
    console.error('[api/promotions/check]', err);
    return NextResponse.json({ ok: false, found: false, error: String(err) }, { status: 500 });
  }
}
