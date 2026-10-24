import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateRequest, resolveUserCompany } from '@/lib/auth/apiAuth';

const admin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function access(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if ('response' in auth) return auth;
  const { uuid, textId } = await resolveUserCompany(auth.user.id);
  if (!uuid || !textId) return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  const db = admin();
  const { data: member } = await db.from('company_members').select('role')
    .eq('company_id', uuid).eq('user_id', auth.user.id).maybeSingle();
  if (!member) return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { db, companyId: textId, userId: auth.user.id, role: member?.role as string | undefined };
}

async function customerExists(db: ReturnType<typeof admin>, companyId: string, customerId: string) {
  const { data, error } = await db.from('Stranke').select('ID stranke')
    .eq('ID Podjetja', companyId).eq('ID stranke', customerId).limit(1).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function GET(request: NextRequest) {
  const user = await access(request);
  if ('response' in user) return user.response;
  const customerId = request.nextUrl.searchParams.get('customer_id');
  if (customerId) {
    if (customerId.length > 150) return NextResponse.json({ error: 'Invalid customer' }, { status: 400 });
    try {
      if (!await customerExists(user.db, user.companyId, customerId)) {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
      }
      const { data, error } = await user.db.rpc('loyalty_summary', {
        p_company_id: user.companyId, p_customer_id: customerId,
      });
      if (error) throw error;
      return NextResponse.json({ ok: true, loyalty: data, can_redeem: user.role === 'owner' || user.role === 'admin' }, { headers: { 'Cache-Control': 'no-store' } });
    } catch {
      return NextResponse.json({ error: 'Could not load loyalty' }, { status: 502 });
    }
  }
  const { data, error } = await user.db.from('loyalty_settings')
    .select('enabled,reward_threshold,reward_name').eq('company_id', user.companyId).maybeSingle();
  if (error) return NextResponse.json({ error: 'Could not load settings' }, { status: 502 });
  return NextResponse.json({ ok: true, settings: data ?? {
    enabled: true, reward_threshold: 10, reward_name: 'Nagrada zvestobe',
  } }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(request: NextRequest) {
  const user = await access(request);
  if ('response' in user) return user.response;
  if (user.role !== 'owner' && user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const threshold = body?.reward_threshold;
  const name = typeof body?.reward_name === 'string' ? body.reward_name.trim() : '';
  if (typeof body?.enabled !== 'boolean' || !Number.isInteger(threshold) || threshold < 2 || threshold > 100 || !name || name.length > 120) {
    return NextResponse.json({ error: 'Invalid settings' }, { status: 400 });
  }
  const { error } = await user.db.from('loyalty_settings').upsert({
    company_id: user.companyId, enabled: body.enabled,
    reward_threshold: threshold, reward_name: name, updated_at: new Date().toISOString(),
  }, { onConflict: 'company_id' });
  if (error) return NextResponse.json({ error: 'Could not save settings' }, { status: 502 });
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const user = await access(request);
  if ('response' in user) return user.response;
  if (user.role !== 'owner' && user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const customerId = body?.customer_id;
  if (typeof customerId !== 'string' || !customerId || customerId.length > 150) {
    return NextResponse.json({ error: 'Invalid customer' }, { status: 400 });
  }
  try {
    if (!await customerExists(user.db, user.companyId, customerId)) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }
    const { data, error } = await user.db.rpc('loyalty_redeem', {
      p_company_id: user.companyId, p_customer_id: customerId, p_redeemed_by: user.userId,
    });
    if (error) {
      if (error.message.includes('insufficient_points')) return NextResponse.json({ error: 'Not enough points' }, { status: 409 });
      if (error.message.includes('loyalty_disabled')) return NextResponse.json({ error: 'Loyalty disabled' }, { status: 409 });
      throw error;
    }
    return NextResponse.json({ ok: true, loyalty: data });
  } catch {
    return NextResponse.json({ error: 'Could not redeem reward' }, { status: 502 });
  }
}
