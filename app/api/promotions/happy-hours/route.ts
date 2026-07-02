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

    const { data: happyHours, error } = await supabase
      .from('happy_hours')
      .select('*')
      .eq('company_id', company_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const hhIds = (happyHours || []).map((h) => h.id);
    const storitveMap: Record<string, string[]> = {};

    if (hhIds.length > 0) {
      const { data: links } = await supabase
        .from('happy_hours_storitve')
        .select('happy_hour_id, storitev_id')
        .in('happy_hour_id', hhIds);

      for (const link of links || []) {
        if (!storitveMap[link.happy_hour_id]) storitveMap[link.happy_hour_id] = [];
        storitveMap[link.happy_hour_id].push(link.storitev_id);
      }
    }

    const result = (happyHours || []).map((h) => ({
      ...h,
      storitev_ids: storitveMap[h.id] || [],
    }));

    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { company_id, naziv, dnevi_v_tednu, cas_zacetek, cas_konec, tip_popusta, vrednost, vse_storitve, aktiven, storitev_ids } = body;

    if (!company_id || !naziv) {
      return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 });
    }

    const auth = await requireCompanyAccess(request, company_id);
    if ('response' in auth) return auth.response;

    const supabase = getClient();

    const { data: hh, error } = await supabase
      .from('happy_hours')
      .insert({ company_id, naziv, dnevi_v_tednu, cas_zacetek, cas_konec, tip_popusta, vrednost, vse_storitve: vse_storitve ?? false, aktiven: aktiven ?? true })
      .select()
      .single();

    if (error) throw error;

    if (!vse_storitve && storitev_ids && storitev_ids.length > 0) {
      const links = (storitev_ids as string[]).map((id) => ({ happy_hour_id: hh.id, storitev_id: id }));
      const { error: linkError } = await supabase.from('happy_hours_storitve').insert(links);
      if (linkError) throw linkError;
    }

    return NextResponse.json({ ok: true, data: { ...hh, storitev_ids: storitev_ids || [] } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
