import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit } from '@/lib/rateLimit';
import { sanitizeInput, isHoneypotFilled } from '@/lib/validation/publicForm';

// TODO: Wire up a real persistence channel here when ready.
// Options:
//   1. Insert into `enterprise_inquiries` Supabase table (create it first).
//   2. Forward to n8n webhook → email the owner.
// For now, the request is logged on the server and the client receives a 200.

const inquirySchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(20).optional(),
  message: z.string().trim().min(2).max(2000),
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

    const { name, email, phone, message } = parsed.data;

    // TODO: replace this log with a real action (Supabase insert / n8n webhook)
    console.log('[enterprise-inquiry] New inquiry:', {
      name: sanitizeInput(name),
      email,
      phone,
      message: sanitizeInput(message),
      receivedAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
