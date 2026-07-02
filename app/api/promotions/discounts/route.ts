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

export async function GET(request: NextRequest) {
  try {
    const company_id = request.nextUrl.searchParams.get('company_id');
    if (!company_id) {
      return NextResponse.json({ ok: false, error: 'company_id required' }, { status: 400 });
    }

    const auth = await requireCompanyAccess(request, company_id);
    if ('response' in auth) return auth.response;

    const supabase = getClient();

    const { data: discounts, error } = await supabase
      .from('popusti')
      .select('*')
      .eq('company_id', company_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const discountIds = (discounts || []).map((d) => d.id);
    const storitveMap: Record<string, string[]> = {};

    if (discountIds.length > 0) {
      const { data: links } = await supabase
        .from('popusti_storitve')
        .select('popust_id, storitev_id')
        .in('popust_id', discountIds);

      for (const link of links || []) {
        if (!storitveMap[link.popust_id]) storitveMap[link.popust_id] = [];
        storitveMap[link.popust_id].push(link.storitev_id);
      }
    }

    const result = (discounts || []).map((d) => ({
      ...d,
      storitev_ids: storitveMap[d.id] || [],
    }));

    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('POST /api/promotions/discounts — body:', JSON.stringify(body, null, 2));
    const { company_id, naziv, tip_popusta, vrednost, datum_zacetek, datum_konec, aktiven, storitev_ids } = body;

    if (!company_id || !naziv) {
      return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 });
    }

    const auth = await requireCompanyAccess(request, company_id);
    if ('response' in auth) return auth.response;

    const supabase = getClient();

    const { data: discount, error } = await supabase
      .from('popusti')
      .insert({
        company_id,
        naziv,
        tip_popusta,
        vrednost,
        datum_zacetek: datum_zacetek || null,
        datum_konec: datum_konec || null,
        aktiven: aktiven ?? true,
      })
      .select()
      .single();

    if (error) {
      console.error('POST /api/promotions/discounts — insert error:', error);
      return NextResponse.json(
        { ok: false, error: error.message, details: error.details, hint: error.hint, code: error.code },
        { status: 500 }
      );
    }

    if (storitev_ids && storitev_ids.length > 0) {
      const links = (storitev_ids as string[]).map((id) => ({ popust_id: discount.id, storitev_id: id }));
      const { error: linkError } = await supabase.from('popusti_storitve').insert(links);
      if (linkError) {
        console.error('POST /api/promotions/discounts — link error:', linkError);
        return NextResponse.json(
          { ok: false, error: linkError.message, details: linkError.details, hint: linkError.hint, code: linkError.code },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true, data: { ...discount, storitev_ids: storitev_ids || [] } });
  } catch (err) {
    console.error('POST /api/promotions/discounts — ERROR:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined },
      { status: 500 }
    );
  }
}
