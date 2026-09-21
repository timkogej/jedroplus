import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit } from '@/lib/rateLimit';
import { sanitizeInput, isHoneypotFilled } from '@/lib/validation/publicForm';

// Enterprise inquiries are forwarded to n8n, which emails them to the team.
// The n8n workflow must exist at N8N_ENTERPRISE_WEBHOOK: Webhook (POST, header
// X-API-Key) → Send Email to `to`. If delivery fails the client is told so and
// shown the address directly — an inquiry is never silently dropped again.
const N8N_ENTERPRISE_WEBHOOK = 'https://n8n.jedroplus.com/webhook/enterprise-inquiry';
const N8N_API_KEY = process.env.N8N_WEBHOOK_API_KEY;
const INQUIRY_RECIPIENT = process.env.ENTERPRISE_INQUIRY_EMAIL ?? 'timkogej@jedroplus.com';

const inquirySchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(20).optional(),
  message: z.string().trim().min(2).max(2000),
  company_id: z.string().max(100).optional(),
  website: z.string().max(0).optional(), // honeypot
});

export async function POST(request: NextRequest) {
  const { success, limit, reset } = await rateLimit(request, 'auth');
  if (!success) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Preveč zahtev. Počakajte trenutek.',
        retryAfter: Math.ceil((reset - Date.now()) / 1000),
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': reset.toString(),
          'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  try {
    const body = await request.json();

    if (isHoneypotFilled(body as { website?: unknown })) {
      return NextResponse.json({ ok: true });
    }

    const parsed = inquirySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'invalid_input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, email, phone, message, company_id } = parsed.data;
    const inquiry = {
      to: INQUIRY_RECIPIENT,
      name: sanitizeInput(name),
      email,
      phone: phone ?? null,
      message: sanitizeInput(message),
      company_id: company_id ?? null,
      receivedAt: new Date().toISOString(),
    };

    // Keep a server-side trace even when delivery works.
    console.log('[enterprise-inquiry] New inquiry:', inquiry);

    try {
      const res = await fetch(N8N_ENTERPRISE_WEBHOOK, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(N8N_API_KEY ? { 'X-API-Key': N8N_API_KEY } : {}),
        },
        body: JSON.stringify(inquiry),
      });
      if (!res.ok) {
        console.error('[enterprise-inquiry] n8n delivery failed:', res.status);
        return NextResponse.json({ ok: false, error: 'delivery_failed' }, { status: 502 });
      }
    } catch (err) {
      console.error('[enterprise-inquiry] n8n delivery error:', err);
      return NextResponse.json({ ok: false, error: 'delivery_failed' }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
