// lib/reservations/mainLink.ts
//
// The company's main booking link is the short one, booking.jedroplus.com/<slug>.
// The booking site sends a visitor of that link to the design the company picked
// as its main one; the pick is stored as `main_booking_link` (the full link of
// that design), which is also what the reminder emails and QR code already read.

export const BOOKING_ORIGIN = 'https://booking.jedroplus.com';

/** Design keys in the order of booking_link_1 … booking_link_6. */
export const DESIGN_KEYS = ['classic', 'modern', 'elegant', 'seasonal', 'magazine', 'casino'] as const;
export type DesignKey = (typeof DESIGN_KEYS)[number];

export const PRO_DESIGN_KEYS: readonly DesignKey[] = ['seasonal', 'magazine', 'casino'];

export function shortBookingLink(slug: string): string {
  const clean = slug.trim();
  return clean ? `${BOOKING_ORIGIN}/${encodeURIComponent(clean)}` : '';
}

/** Design a stored main link points at (the last path segment); classic when none. */
export function designKeyFromLink(link: string): DesignKey {
  let path = link.trim();
  try {
    path = new URL(path).pathname;
  } catch {
    /* not a full URL — treat it as a path */
  }
  const last = path.split('/').filter(Boolean).pop()?.toLowerCase() ?? '';
  return (DESIGN_KEYS as readonly string[]).includes(last) ? (last as DesignKey) : 'classic';
}
