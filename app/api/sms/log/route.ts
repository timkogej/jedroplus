// app/api/sms/log/route.ts
//
// Latest SMS for the caller's company with their delivery status (sms_log,
// written by n8n and BulkGate's delivery reports). Owners and admins only.
// Before migration 1790400000 the table is missing: available=false.

import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerOrAdmin } from '@/lib/auth/ownerAccess';

const LIMIT = 20;

export async function GET(request: NextRequest) {
  const access = await requireOwnerOrAdmin(request);
  if ('response' in access) return access.response;
  const { textId, admin } = access;

  const { data, error } = await admin
    .from('sms_log')
    .select('id, client_id, phone, kind, status, error, created_at')
    .eq('company_id', textId)
    .order('created_at', { ascending: false })
    .limit(LIMIT);

  if (error) {
    return NextResponse.json({ ok: true, available: false, rows: [] });
  }

  return NextResponse.json({ ok: true, available: true, rows: data ?? [] });
}
