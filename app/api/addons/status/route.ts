import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireCompanyAccess } from '@/lib/auth/apiAuth';
import { computeBillingUsage, NEAR_LIMIT_PERCENT } from '@/lib/billing/usage';
import { notifyOwnerInBackground } from '@/lib/email/notifyOwner';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const company_id = searchParams.get('company_id');

  if (!company_id) {
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 });
  }

  // Subscription, usage and Stripe ids are private to the company's members.
  const auth = await requireCompanyAccess(request, company_id);
  if ('response' in auth) return auth.response;

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

    const [
      { data: smsUsage },
      { data: emailUsage },
      { data: employeeLimits },
      { count: memberCount },
    ] = await Promise.all([
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

      // People with a login in this company (owner, admins, staff) — the
      // thing the "team members" seat limit actually counts.
      admin
        .from('company_members')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', company_id),
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

    const payload = {
      subscription,
      smsUsage,
      emailUsage,
      employeeLimits,
      activeEmployeeCount: activeEmployeeCount ?? 0,
      memberCount: memberCount ?? 0,
    };

    // Warn the owner by email when a channel is nearly or fully used up. This
    // route is the one place that already knows the real numbers; n8n drops
    // repeats (one mail per threshold, channel and month).
    const usage = computeBillingUsage(payload as Parameters<typeof computeBillingUsage>[0]);

    // n8n addresses companies by their text business id ("7LHB28"); this route
    // is called with the UUID.
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(company_id);
    let textCompanyId = company_id;
    if (isUuid) {
      const { data: companyRow } = await admin
        .from('companies')
        .select('company_id')
        .eq('id', company_id)
        .maybeSingle();
      textCompanyId = (companyRow?.company_id as string | undefined) ?? '';
    }

    for (const channel of ['sms', 'email'] as const) {
      const c = usage[channel];
      if (c.total <= 0) continue;
      if (textCompanyId && (c.exhausted || c.percent >= NEAR_LIMIT_PERCENT)) {
        notifyOwnerInBackground({
          event: 'quota_reached',
          companyId: textCompanyId,
          data: { channel, used: c.used, total: c.total },
        });
      }
    }

    return NextResponse.json(payload);
  } catch (e) {
    console.error('[api/addons/status]', e);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
