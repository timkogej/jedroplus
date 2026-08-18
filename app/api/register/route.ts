import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { rateLimit } from '@/lib/rateLimit'
import { sanitizeInput, isHoneypotFilled } from '@/lib/validation/publicForm'

const N8N_WEBHOOK = 'https://n8n.jedroplus.com/webhook/client-registration'

const registerSchema = z.object({
  company_id: z.string().min(1),
  slug: z.string().min(1),
  ime: z.string().trim().min(1).max(50),
  priimek: z.string().trim().min(1).max(50),
  email: z.string().trim().email().max(254),
  telefon: z.string().trim().regex(/^[\d\s+\-().]{6,20}$/),
  spol: z.enum(['moski', 'zenski', 'prefer_not']),
  opombe: z.string().max(500).optional(),
  gdpr: z.boolean(),
  marketing_consent: z.boolean(),
  website: z.string().max(0).optional(), // honeypot
})

export async function POST(req: NextRequest) {
  const { success, limit, reset } = await rateLimit(req, 'auth')
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
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (isHoneypotFilled(body as { website?: unknown })) {
    return NextResponse.json({ ok: true })
  }

  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_input', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { company_id, slug, ime, priimek, email, telefon, spol, opombe, gdpr, marketing_consent } = parsed.data
  const payload = {
    company_id, slug, ime, priimek, email, telefon, spol, gdpr, marketing_consent,
    opombe: opombe ? sanitizeInput(opombe) : opombe,
  }

  try {
    const res = await fetch(N8N_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const responseData = await res.json().catch(() => ({}))
    return NextResponse.json(responseData, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'upstream_error' }, { status: 502 })
  }
}
