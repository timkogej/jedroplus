// lib/reservations/fetchReservationSettings.server.ts
//
// Server-side loader for the Rezervacije page. Session-aware counterpart to the
// browser fetchSettings(). Authenticates via the cookie session, then reads the
// single "Podatki podjetij" row (through the existing loadCompanyRow, unchanged)
// and returns it as a fully-parsed ReservationSettings object so the client shell
// can seed state without a spinner flash.
//
// The read itself still goes through loadCompanyRow (supabaseReadOnly), matching
// the browser path exactly, so server-seeded and client-fetched output are
// identical. The cookie session is used only to gate access.

import "server-only";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { loadCompanyRow } from "@/lib/settingsStore";
import {
  parseReservationSettings,
  type ReservationSettings,
} from "@/lib/reservations/reservationSettings";

/**
 * Loads the Rezervacije page's initial settings server-side for the given
 * company. Returns null when there is no authenticated session or no company,
 * so the page falls back to the client-side fetch path.
 */
export async function fetchReservationSettingsServer(
  companyId: string
): Promise<ReservationSettings | null> {
  if (!companyId || companyId.trim() === "") return null;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  try {
    const { data: podatkiRow } = await loadCompanyRow(companyId);
    return parseReservationSettings(podatkiRow);
  } catch (error) {
    console.error("[Reservations.server] settings fetch error:", error);
    return null;
  }
}
