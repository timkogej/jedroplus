import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateRequest, resolveUserCompany } from '@/lib/auth/apiAuth';

export const ANNOUNCEMENT_BUCKET = 'portal-announcements';

export function announcementAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function requireAnnouncementPublisher(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if ('response' in auth) return auth;
  const { uuid, textId } = await resolveUserCompany(auth.user.id);
  if (!uuid || !textId) {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  const db = announcementAdmin();
  const { data: member, error } = await db.from('company_members').select('role')
    .eq('company_id', uuid).eq('user_id', auth.user.id).maybeSingle();
  if (error || (member?.role !== 'owner' && member?.role !== 'admin')) {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { db, companyId: textId, userId: auth.user.id };
}

export async function recipientExists(db: ReturnType<typeof announcementAdmin>, companyId: string, email: string) {
  const escaped = email.replace(/[\\%_]/g, '\\$&');
  const { data, error } = await db.from('Stranke').select('"Email stranke"')
    .eq('ID Podjetja', companyId).ilike('Email stranke', escaped).limit(20);
  if (error) throw error;
  return (data ?? []).some((row) => String(row['Email stranke'] ?? '').trim().toLowerCase() === email);
}

export async function imageBytes(file: File): Promise<{ bytes: Uint8Array; extension: string; mime: string } | null> {
  if (file.size === 0 || file.size > 3 * 1024 * 1024) return null;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const png = file.type === 'image/png' && bytes.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((value, i) => bytes[i] === value);
  const jpg = file.type === 'image/jpeg' && bytes.length >= 3 &&
    bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = file.type === 'image/webp' && bytes.length >= 12 &&
    new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' &&
    new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP';
  if (!png && !jpg && !webp) return null;
  return { bytes, extension: png ? 'png' : jpg ? 'jpg' : 'webp', mime: file.type };
}
