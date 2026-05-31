import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const company_id = searchParams.get('company_id');

  if (!company_id) {
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 });
  }

  if (!serviceRoleKey) {
    return NextResponse.json({ success: false, message: 'Service role key not configured' }, { status: 500 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: subscription } = await admin
      .from('company_subscriptions')
      .select(`
        id, status, provider_subscription_id,
        current_period_start, current_period_end,
        sms_addon_monthly, email_addon_monthly,
        sms_addon_stripe_item_id, email_addon_stripe_item_id,
        sms_addon_cancel_at_period_end, email_addon_cancel_at_period_end,
        sms_quota_override, email_quota_override,
        plan:plans (
          code, name, price_monthly_cents,
          sms_quota_monthly, email_quota_monthly,
          sms_enabled, email_enabled, max_employees
        )
      `)
      .eq('company_id', company_id)
      .eq('status', 'active')
      .maybeSingle();

    const today = new Date().toISOString().split('T')[0];

    const [{ data: smsUsage }, { data: emailUsage }, { data: employeeLimits }] = await Promise.all([
      admin
        .from('company_sms_usage')
        .select('sent_count, period_start, period_end')
        .eq('company_id', company_id)
        .lte('period_start', today)
        .gte('period_end', today)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),

      admin
        .from('company_email_usage')
        .select('sent_count, period_start, period_end')
        .eq('company_id', company_id)
        .lte('period_start', today)
        .gte('period_end', today)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),

      admin
        .from('company_user_limits')
        .select('included_users, extra_users, max_users, stripe_subscription_item_id, cancel_at_period_end')
        .eq('company_id', company_id)
        .maybeSingle(),
    ]);

    // Count active employees from Osebe table.
    // NOTE: "ID podjetja" may store companies.id (UUID) or companies.company_id (text).
    // Verify by checking: SELECT "ID podjetja" FROM "Osebe" LIMIT 3
    // and comparing to the company_id UUID passed here.
    const { count: activeEmployeeCount } = await admin
      .from('Osebe')
      .select('*', { count: 'exact', head: true })
      .eq('ID podjetja', company_id)
      .eq('Status', 'active');

    return NextResponse.json({
      subscription,
      smsUsage,
      emailUsage,
      employeeLimits,
      activeEmployeeCount: activeEmployeeCount ?? 0,
    });
  } catch (e) {
    console.error('[api/addons/status]', e);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
