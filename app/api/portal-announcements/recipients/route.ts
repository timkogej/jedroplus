import { NextRequest, NextResponse } from 'next/server';
import { requireAnnouncementPublisher } from '@/lib/portalAnnouncementsServer';

export async function GET(request: NextRequest) {
  const access = await requireAnnouncementPublisher(request);
  if ('response' in access) return access.response;
  const query = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (query.length < 2 || query.length > 80) {
    return NextResponse.json({ recipients: [] });
  }
  const escaped = query.replace(/[\\%_]/g, '\\$&');
  const fields = ['Ime', 'Priimek', 'Email stranke'] as const;
  const result = await Promise.all(fields.map((field) => access.db.from('Stranke')
    .select('Ime,Priimek,"Email stranke"')
    .eq('ID Podjetja', access.companyId)
    .ilike(field, `%${escaped}%`)
    .limit(10)));
  if (result.some((item) => item.error)) {
    return NextResponse.json({ error: 'Could not search customers' }, { status: 502 });
  }
  const emails = new Set<string>();
  const recipients = result.flatMap((item) => item.data ?? []).flatMap((row) => {
    const email = String(row['Email stranke'] ?? '').trim().toLowerCase();
    if (!email || emails.has(email)) return [];
    emails.add(email);
    return [{ email, name: `${row.Ime ?? ''} ${row.Priimek ?? ''}`.trim() }];
  }).slice(0, 12);
  return NextResponse.json({ recipients }, { headers: { 'Cache-Control': 'no-store' } });
}
