// lib/utils/pastCutoff.ts
//
// "Zaposleni ne vidi starih terminov": staff_role_permissions.past_appointments_days
//   null = vsi pretekli termini (privzeto), 0 = samo danes in naprej, N = od (danes − N dni).
// Velja samo za vlogo zaposleni; lastnik in admin vidita vse.

/** Najstarejši datum ("yyyy-MM-dd"), ki ga oseba še vidi, ali null, če omejitve ni. */
export function pastCutoffKey(days: number | null | undefined, today: string): string | null {
  if (days === null || days === undefined || !Number.isFinite(days) || days < 0) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
  if (!m) return null;
  // UTC, da prehod na poletni čas ne premakne dneva.
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  d.setUTCDate(d.getUTCDate() - Math.floor(days));
  return d.toISOString().slice(0, 10);
}

const DATE_KEYS = ['Datum', 'datum', 'date', 'Date', 'start_date', 'booking_date'];

/** Odstrani vrstice terminov, ki so starejše od meje. Vrstice brez berljivega datuma ostanejo. */
export function filterRowsByCutoff<T extends Record<string, unknown>>(rows: T[], cutoff: string | null): T[] {
  if (!cutoff) return rows;
  return rows.filter((row) => {
    for (const k of DATE_KEYS) {
      const v = row[k];
      if (typeof v === 'string') {
        const key = v.slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(key)) return key >= cutoff;
      }
    }
    return true;
  });
}
