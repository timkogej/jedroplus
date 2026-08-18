// Shared helpers for unauthenticated public-form API routes
// (registration, enterprise inquiry, ...). Same approach as the
// booking app's src/lib/validations/booking.ts, adapted to run
// server-side here instead of in a client hook.

export function sanitizeInput(text: string): string {
  if (typeof text !== 'string') return ''
  return text.replace(/<[^>]*>/g, '').replace(/[<>]/g, '').trim().slice(0, 2000)
}

export function isHoneypotFilled(data: { website?: unknown }): boolean {
  return typeof data.website === 'string' && data.website.length > 0
}
