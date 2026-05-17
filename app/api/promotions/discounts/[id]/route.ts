import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getClient() {
  return createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { naziv, tip_popusta, vrednost, datum_zacetek, datum_konec, aktiven, storitev_ids } = body;

    const supabase = getClient();

    const { data: discount, error } = await supabase
      .from('popusti')
      .update({ naziv, tip_popusta, vrednost, datum_zacetek: datum_zacetek || null, datum_konec: datum_konec || null, aktiven })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('PUT /api/promotions/discounts/[id] — update error:', error);
      return NextResponse.json(
        { ok: false, error: error.message, details: error.details, hint: error.hint, code: error.code },
        { status: 500 }
      );
    }

    // Replace service links
    await supabase.from('popusti_storitve').delete().eq('popust_id', id);

    if (storitev_ids && storitev_ids.length > 0) {
      const links = (storitev_ids as string[]).map((sid) => ({ popust_id: id, storitev_id: sid }));
      const { error: linkError } = await supabase.from('popusti_storitve').insert(links);
      if (linkError) {
        console.error('PUT /api/promotions/discounts/[id] — link error:', linkError);
        return NextResponse.json(
          { ok: false, error: linkError.message, details: linkError.details, hint: linkError.hint, code: linkError.code },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true, data: { ...discount, storitev_ids: storitev_ids || [] } });
  } catch (err) {
    console.error('PUT /api/promotions/discounts/[id] — ERROR:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const supabase = getClient();

    const { error } = await supabase.from('popusti').delete().eq('id', id);
    if (error) {
      console.error('DELETE /api/promotions/discounts/[id] — error:', error);
      return NextResponse.json(
        { ok: false, error: error.message, details: error.details, code: error.code },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/promotions/discounts/[id] — ERROR:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
