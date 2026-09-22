// lib/appointments/status.ts
//
// One reading of the free-text booking status column, shared by Termini,
// Koledar and the dashboard so their counts agree. The backend writes both
// English and Slovenian values ("completed", "Zaključen", "Ni prišel" …).

export type NormalizedAppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

export function normalizeAppointmentStatus(raw: unknown): NormalizedAppointmentStatus {
  const s = String(raw ?? '').toLowerCase().trim();
  if (s.includes('confirm') || s.includes('potrj')) return 'confirmed';
  if (s.includes('complet') || s.includes('zakljuc') || s.includes('zaključ') || s.includes('done') || s.includes('končan') || s.includes('koncan')) {
    return 'completed';
  }
  if (s.includes('cancel') || s.includes('odpoved') || s.includes('preklic')) return 'cancelled';
  if (s.includes('no_show') || s.includes('no show') || s.includes('ni_prisel') || s.includes('ni prišel') || s.includes('ni prisel')) {
    return 'no_show';
  }
  return 'scheduled';
}

/** Still to be closed: not completed, cancelled or marked as no-show. */
export function isOpenAppointmentStatus(raw: unknown): boolean {
  const s = normalizeAppointmentStatus(raw);
  return s === 'scheduled' || s === 'confirmed';
}
