import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getClient() {
  return createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { naziv, dnevi_v_tednu, cas_zacetek, cas_konec, tip_popusta, vrednost, vse_storitve, aktiven, storitev_ids } = body;

    const supabase = getClient();

    const { data: hh, error } = await supabase
      .from('happy_hours')
      .update({ naziv, dnevi_v_tednu, cas_zacetek, cas_konec, tip_popusta, vrednost, vse_storitve, aktiven })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Replace service links
    await supabase.from('happy_hours_storitve').delete().eq('happy_hour_id', id);

    if (!vse_storitve && storitev_ids && storitev_ids.length > 0) {
      const links = (storitev_ids as string[]).map((sid) => ({ happy_hour_id: id, storitev_id: sid }));
      const { error: linkError } = await supabase.from('happy_hours_storitve').insert(links);
      if (linkError) throw linkError;
    }

    return NextResponse.json({ ok: true, data: { ...hh, storitev_ids: storitev_ids || [] } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = getClient();

    const { error } = await supabase.from('happy_hours').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
