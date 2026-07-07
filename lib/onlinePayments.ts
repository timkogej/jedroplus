import { supabaseReadOnly } from '@/src/lib/supabaseReadOnly';

export function isJedroProPlan(planCode?: string | null): boolean {
  const normalized = String(planCode ?? '').toUpperCase().replace(/[\s-]+/g, '_');
  return normalized === 'JEDRO_PRO' || normalized === 'JEDRO_PREMIUM';
}

export function parseSettingBool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'da', 'enabled', 'omogoceno', 'omogočeno'].includes(normalized)) return true;
    if (['false', '0', 'no', 'ne', 'disabled', 'onemogoceno', 'onemogočeno'].includes(normalized)) return false;
  }
  return fallback;
}

export async function hasPosOnlinePaymentsSubscription(companyUuid?: string | null): Promise<boolean> {
  if (!companyUuid) return false;

  try {
    const { data, error } = await supabaseReadOnly
      .from('pos subscriptions')
      .select('plan')
      .eq('company_id', companyUuid)
      .in('plan', ['pro', 'plus'])
      .limit(1);

    if (error) {
      console.warn('[onlinePayments] Unable to read POS subscription:', error.message);
      return false;
    }

    return (data ?? []).some((row) => ['pro', 'plus'].includes(String(row.plan ?? '').toLowerCase()));
  } catch (error) {
    console.warn('[onlinePayments] POS subscription check failed:', error);
    return false;
  }
}
