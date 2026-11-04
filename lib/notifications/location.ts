// lib/notifications/location.ts
//
// With several locations a booking notification also says where it is. The
// text itself is written elsewhere (n8n), so the name is added when the
// notification is shown or pushed. One location: nothing is added.

export interface AppointmentNotificationRef {
  type?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  metadata?: Record<string, unknown> | null;
}

/** The appointment a notification is about (text "ID termina" or row id), if any. */
export function appointmentRefOf(n: AppointmentNotificationRef): string | null {
  const entity = n.entity_type?.toLowerCase() ?? '';
  const type = n.type?.toLowerCase() ?? '';
  if (entity !== 'appointment' && !type.startsWith('appointment_')) return null;
  const fromMeta = typeof n.metadata?.termin_id === 'string' ? n.metadata.termin_id : null;
  const ref = (n.entity_id ?? fromMeta ?? '').trim();
  return ref || null;
}

/** "text · Salon Maribor"; unchanged when there is no name or it is already there. */
export function appendLocation(text: string, locationName: string | null | undefined): string {
  const name = locationName?.trim();
  if (!name || text.includes(name)) return text;
  return text ? `${text} · ${name}` : name;
}
