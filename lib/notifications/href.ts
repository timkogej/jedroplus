// lib/notifications/href.ts
//
// Kam vodi obvestilo — isto pravilo za klik v aplikaciji in za klik na push.
// Večina pisalcev nastavi action_url; n8n Booking ga pri novi rezervaciji ne,
// zato ga izpeljemo iz entity_type/entity_id (koledar odpre ta termin).

export interface NotificationLinkFields {
  action_url?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  metadata?: Record<string, unknown> | null;
  type?: string | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function notificationHref(n: NotificationLinkFields): string | null {
  const url = n.action_url?.trim();
  if (url) return url;

  const entity = n.entity_type?.toLowerCase() ?? '';
  const type = n.type?.toLowerCase() ?? '';

  if (entity === 'appointment' || type.startsWith('appointment_')) {
    const params = new URLSearchParams();
    const id = n.entity_id ?? (typeof n.metadata?.termin_id === 'string' ? n.metadata.termin_id : null);
    if (id) params.set('termin', String(id));
    const datum = n.metadata?.datum;
    if (typeof datum === 'string' && ISO_DATE.test(datum)) params.set('datum', datum);
    const query = params.toString();
    return query ? `/koledar?${query}` : '/koledar';
  }

  if (entity.startsWith('receptionist')) return '/receptionist-plus';

  return null;
}

/** Samo poti znotraj aplikacije ali https povezave — nikoli javascript: ipd. */
export function safeNotificationHref(n: NotificationLinkFields, fallback = '/obvestila'): string {
  const href = notificationHref(n);
  if (!href) return fallback;
  if (href.startsWith('/') && !href.startsWith('//')) return href;
  if (/^https:\/\//i.test(href)) return href;
  return fallback;
}
