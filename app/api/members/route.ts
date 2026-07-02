// app/api/members/route.ts
// Fetches all company members + their auth display names & emails.
// Uses service role key — never exposed to browser.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireCompanyAccess } from '@/lib/auth/apiAuth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function resolveDisplayName(user: { email?: string; user_metadata?: Record<string, unknown> }, uid: string): string {
  const m = user.user_metadata ?? {};
  if (m.full_name && typeof m.full_name === 'string') return m.full_name;
  if (m.name && typeof m.name === 'string') return m.name;
  if (m.first_name || m.last_name) {
    const combined = `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim();
    if (combined) return combined;
  }
  if (m.ime || m.priimek) {
    const combined = `${m.ime ?? ''} ${m.priimek ?? ''}`.trim();
    if (combined) return combined;
  }
  if (user.email) {
    const prefix = user.email.split('@')[0];
    return prefix.charAt(0).toUpperCase() + prefix.slice(1);
  }
  return uid;
}

export async function POST(request: NextRequest) {
  if (!serviceRoleKey || serviceRoleKey === 'your_service_role_key_here') {
    return NextResponse.json(
      { ok: false, error: 'Service role key not configured' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json() as { company_id?: string; user_ids?: string[] };

    // Auth + company ownership. company_id (the company UUID) is required so we
    // can verify the caller belongs to the company they're querying — this also
    // closes the user_ids-only path, which could otherwise enumerate arbitrary
    // users' emails.
    const auth = await requireCompanyAccess(request, body.company_id);
    if ('response' in auth) return auth.response;

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let user_ids: string[] = [];
    let members: { id: string; user_id: string; role: string }[] = [];

    if (body.company_id) {
      // Fetch all company members with admin client (bypasses RLS)
      const { data, error } = await adminClient
        .from('company_members')
        .select('id, user_id, role')
        .eq('company_id', body.company_id);

      if (error) {
        console.error('[api/members] company_members fetch error:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }

      members = (data ?? []) as { id: string; user_id: string; role: string }[];
      user_ids = members.map((m) => m.user_id);
    } else if (Array.isArray(body.user_ids) && body.user_ids.length > 0) {
      user_ids = body.user_ids;
    }

    if (user_ids.length === 0) {
      return NextResponse.json({ ok: true, members: [], users: {} });
    }

    // Fetch auth info for all user_ids
    const results: Record<string, { display_name: string; email: string }> = {};

    await Promise.all(
      user_ids.map(async (uid) => {
        try {
          const { data, error } = await adminClient.auth.admin.getUserById(uid);
          if (!error && data?.user) {
            results[uid] = {
              display_name: resolveDisplayName(data.user, uid),
              email: data.user.email || '',
            };
          }
        } catch {
          // skip this user
        }
      })
    );

    return NextResponse.json({ ok: true, members, users: results });
  } catch (error) {
    console.error('[api/members] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
